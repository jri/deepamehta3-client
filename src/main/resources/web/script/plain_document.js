function PlainDocument() {

    // Settings
    DEFAULT_FIELD_WIDTH = 60    // in chars
    DEFAULT_AREA_HEIGHT = 30    // in chars
    UPLOAD_DIALOG_WIDTH = "50em"
    DELETE_DIALOG_WIDTH = 350   // in pixel

    // The upload dialog
    $("#attachment_dialog").dialog({
        modal: true, autoOpen: false, draggable: false, resizable: false, width: UPLOAD_DIALOG_WIDTH
    })
    $("#upload-target").load(upload_complete)
    // The delete dialog
    $("#delete_dialog").dialog({
        modal: true, autoOpen: false, draggable: false, resizable: false, width: DELETE_DIALOG_WIDTH,
        buttons: {"Delete": do_delete}
    })
    // The autocomplete list
    $("#document-form").append($("<div>").addClass("autocomplete-list"))
    autocomplete_item = -1



    /**************************************************************************************************/
    /**************************************** Overriding Hooks ****************************************/
    /**************************************************************************************************/



    this.render_document = function(doc) {

        var defined_relation_topics = []

        render_fields()
        render_attachments()
        render_relations()
        render_buttons()

        function render_fields() {
            for (var i = 0, field; field = get_type(doc).fields[i]; i++) {
                // field name
                render_field_name(field)
                // field value
                var html = trigger_hook("render_field_content", field, doc, related_topics(field))[0]
                if (html != undefined) {
                    $("#detail-panel").append($("<div>").addClass("field-value").append(html))
                } else {
                    alert("WARNING (PlainDocument.render_document):\n" +
                        "field \"" + field.uri + "\" of topic " + doc.id + " is not handled by any plugin.\n" +
                        "field model=" + JSON.stringify(field.model) + "\n" +
                        "field view=" + JSON.stringify(field.view))
                }
            }

            function related_topics(field) {
                if (field.model.type == "relation") {
                    var topics = get_relation_field_content(doc.id, field)
                    defined_relation_topics = defined_relation_topics.concat(topics)
                    return topics
                }
            }
        }

        function render_attachments() {
            if (doc._attachments) {
                render_field_name("Attachments")
                var field_value = $("<div>").addClass("field-value")
                for (var attach in doc._attachments) {
                    var a = $("<a>").attr("href", dmc.uri + doc.id + "/" + attach).text(attach)
                    field_value.append(a).append("<br>")
                }
                $("#detail-panel").append(field_value)
            }
        }

        function render_relations() {
            var topics = dmc.get_related_topics(doc.id, [], [], ["SEARCH_RESULT;OUTGOING"])
            // don't render topics already rendered via "defined relations"
            substract(topics, defined_relation_topics, function(topic, drt) {
                return topic.id == drt.id
            })
            //
            render_field_name("Relations (" + topics.length + ")")
            var field_value = $("<div>").addClass("field-value")
            field_value.append(render_topic_list(topics))
            $("#detail-panel").append(field_value)
        }

        function render_buttons() {
            $("#lower-toolbar").append("<button id='edit-button' type='button'>")
            $("#lower-toolbar").append("<button id='attach-button' type='button'>")
            $("#lower-toolbar").append("<button id='delete-button' type='button'>")
            ui.button("edit-button", edit_document, "Edit", "pencil")
            ui.button("attach-button", attach_file, "Upload Attachment", "document")
            ui.button("delete-button", confirm_delete, "Delete", "trash")
        }
    }

    this.render_form = function(topic) {
        plain_doc = this
        this.topic_buffer = {}
        empty_detail_panel(true)
        //
        for (var i = 0, field; field = get_type(topic).fields[i]; i++) {
            // field name
            render_field_name(field)
            // field value
            var html = trigger_hook("render_form_field", field, topic, related_topics(field))[0]
            if (html != undefined) {
                $("#detail-panel").append($("<div>").addClass("field-value").append(html))
                trigger_hook("post_render_form_field", field, topic)
            } else {
                alert("WARNING (PlainDocument.render_form):\n" +
                    "field \"" + field.uri + "\" of topic " + topic.id + " is not handled by any plugin.\n" +
                    "field model=" + JSON.stringify(field.model) + "\n" +
                    "field view=" + JSON.stringify(field.view))
            }
        }

        function related_topics(field) {
            if (field.model.type == "relation") {
                var topics = get_relation_field_content(topic.id, field)
                // buffer current topic selection to compare it at submit time
                plain_doc.topic_buffer[field.uri] = topics
                //
                return topics
            }
        }
    }

    this.post_render_form = function(doc) {
        // buttons
        $("#lower-toolbar").append("<button id='save-button' type='button'>")
        $("#lower-toolbar").append("<button id='cancel-button' type='button'>")
        ui.button("save-button", do_update_document, "Save", "circle-check", true)
        ui.button("cancel-button", do_cancel_editing, "Cancel")
    }

    this.context_menu_items = function() {
        return [
            {label: "Hide", handler: "hide"},
            {label: "Relate", handler: "relate"}
        ]
    }



    /************************************************************************************************/
    /**************************************** Custom Methods ****************************************/
    /************************************************************************************************/



    /* Context Menu Commands */

    this.hide = function() {
        hide_topic(selected_topic.id)
    }

    this.relate = function(event) {
        canvas.begin_relation(selected_topic.id, event)
    }

    /* Helper */

    /**
     * @param   field   a field object or a string.
     */
    function render_field_name(field, suffix) {
        var name
        if (typeof(field) == "string") {
            name = field
        } else {
            name = field_label(field)
            if (suffix) {
                name += suffix
            }
        }
        $("#detail-panel").append($("<div>").addClass("field-name").text(name))
    }

    /**
     * Returns the content of a field of type "relation".
     *
     * @return  Array of Topic objects.
     */
    function get_relation_field_content(topic_id, field) {
        return dmc.get_related_topics(topic_id, [field.model.related_type_uri], [], ["SEARCH_RESULT"])
    }

    /* ---------------------------------------- Private Methods ---------------------------------------- */

    /**
     * Invoked when the user presses the "Save" button.
     */
    function do_update_document() {
        //
        trigger_hook("pre_submit_form", selected_topic)
        //
        // 1) update memory
        // Remember old property values
        var old_properties = clone(selected_topic.properties)
        // Reads out values from GUI elements and update the topic
        for (var i = 0, field; field = get_type(selected_topic).fields[i]; i++) {
            var content = trigger_hook("get_field_content", field, selected_topic)[0]
            // Note: undefined content is an error (means: field type not handled by any plugin).
            // null is a valid hook result (means: plugin prevents the field from being updated).
            if (content !== undefined) {
                if (content != null) {
                    selected_topic.properties[field.uri] = content
                }
            } else {
                alert("WARNING (PlainDocument.do_update_document):\n" +
                    "field \"" + field.uri + "\" of topic " + selected_topic.id + " is not handled by any plugin.\n" +
                    "field model=" + JSON.stringify(field.model) + "\n" +
                    "field view=" + JSON.stringify(field.view))
            }
        }
        // 2) update DB
        update_topic(selected_topic, old_properties)
        // 3) update GUI
        var topic_id = selected_topic.id
        var label = topic_label(selected_topic)
        canvas.set_topic_label(topic_id, label)
        canvas.refresh()
        show_document()
        // trigger hook
        trigger_hook("post_set_topic_label", topic_id, label)
    }

    function do_cancel_editing() {
        show_document()
    }

    /* Attachments */

    function attach_file() {
        $("#attachment_form").attr("action", dmc.uri + selected_topic.id)
        $("#attachment_form_rev").attr("value", selected_topic._rev)
        $("#attachment_dialog").dialog("open")
    }

    function upload_complete() {
        $("#attachment_dialog").dialog("close")
        show_document()
    }

    /* Delete */

    function confirm_delete() {
        $("#delete_dialog").dialog("open")
    }

    function do_delete() {
        $("#delete_dialog").dialog("close")
        delete_topic(selected_topic)
    }



    /***********************/
    /*** Auto-Completion ***/
    /***********************/



    /**
     * Auto-Completion main function. Triggered for every keystroke.
     */
    this.autocomplete = function(event) {
        // log("autocomplete: which=" + event.which)
        if (handle_special_input(event)) {
            return
        }
        // assertion
        if (this.id.substr(0, 6) != "field_") {
            alert("WARNING (PlainDocument.autocomplete):\n" +
                "document " + selected_topic.id + " has unexpected element id (" + this.id + ").\n" +
                "It is expected to begin with \"field_\"")
            return
        }
        // Holds the matched items (model). These items are rendered as pulldown menu (the "autocomplete list", view).
        // Element type: array, holds all item fields as stored by the fulltext index function.
        autocomplete_items = []
        var item_id = 0
        //
        try {
            var field = get_field(this)
            var searchterm = searchterm(field, this)
            if (searchterm) {
                // --- trigger search for each fulltext index ---
                for (var i = 0, index; index = field.view.autocomplete_indexes[i]; i++) {
                    var result = dmc.search_topics(index, searchterm + "*")
                    //
                    if (result.rows.length && !autocomplete_items.length) {
                        show_autocomplete_list(this)
                    }
                    // --- add each result item to the autocomplete list ---
                    for (var j = 0, row; row = result.rows[j]; j++) {
                        // Note: only default field(s) is/are respected.
                        var item = row.fields["default"]
                        // Note: if the fulltext index function stores only one field per document
                        // we get it as a string, otherwise we get an array.
                        if (typeof(item) == "string") {
                            item = [item]
                        }
                        // --- Add item to model ---
                        autocomplete_items.push(item)
                        // --- Add item to view ---
                        var ac_item = trigger_doctype_hook(selected_topic, "render_autocomplete_item", item)
                        var a = $("<a>").attr({href: "", id: item_id++}).append(ac_item)
                        a.mousemove(item_hovered)
                        a.mousedown(process_selection)
                        // Note: we use "mousedown" instead of "click" because the click causes loosing the focus
                        // and "lost focus" is fired _before_ "mouseup" and thus "click" would never be fired.
                        // At least as long as we hide the autocompletion list on "hide focus" which we do for
                        // the sake of simplicity. This leads to non-conform GUI behavoir (action on mousedown).
                        // A more elaborated rule for hiding the autocompletion list is required.
                        $(".autocomplete-list").append(a)
                    }
                }
            }
        } catch (e) {
            alert("Error while searching: " + JSON.stringify(e))
        }
        //
        if (!autocomplete_items.length) {
            hide_autocomplete_list("no result")
        }

        function searchterm(field, input_element) {
            if (field.view.autocomplete_style == "item list") {
                var searchterm = current_term(input_element)
                // log("pos=" + searchterm[1] + "cpos=" + searchterm[2] + " searchterm=\"" + searchterm[0] + "\"")
                return $.trim(searchterm[0])
            } else {
                // autocomplete_style "default"
                return input_element.value
            }
        }
    }

    function handle_special_input(event) {
        // log("handle_special_input: event.which=" + event.which)
        if (event.which == 13) {            // return
            process_selection()
            return true
        } if (event.which == 27) {          // escape
            hide_autocomplete_list("aborted (escape)")
            return true
        } if (event.which == 38) {          // cursor up
            autocomplete_item--
            if (autocomplete_item == -2) {
                autocomplete_item = autocomplete_items.length -1
            }
            // log("handle_special_input: cursor up, autocomplete_item=" + autocomplete_item)
            activate_list_item()
            return true
        } else if (event.which == 40) {     // cursor down
            autocomplete_item++
            if (autocomplete_item == autocomplete_items.length) {
                autocomplete_item = -1
            }
            // log("handle_special_input: cursor down, autocomplete_item=" + autocomplete_item)
            activate_list_item()
            return true
        }
    }

    function process_selection() {
        if (autocomplete_item != -1) {
            var input_element = get_input_element()
            // trigger hook to get the item (string) to insert into the input element
            var item = trigger_doctype_hook(selected_topic, "process_autocomplete_selection",
                autocomplete_items[autocomplete_item])
            //
            var field = get_field(input_element)
            if (field.view.autocomplete_style == "item list") {
                // term[0]: the term to replace, starts immediately after the comma
                // term[1]: position of the previous comma or -1
                var term = current_term(input_element)
                var value = input_element.value
                input_element.value = value.substring(0, term[1] + 1)
                if (term[1] + 1 > 0) {
                    input_element.value += " "
                }
                input_element.value += item + ", " + value.substring(term[1] + 1 + term[0].length)
                update_viewport(input_element)
            } else {
                // autocomplete_style "default"
                input_element.value = item
            }
        }
        hide_autocomplete_list("selection performed")
    }

    function current_term(input_element) {
        var cpos = input_element.selectionStart
        var pos = input_element.value.lastIndexOf(",", cpos - 1)
        var term = input_element.value.substring(pos + 1, cpos)
        return [term, pos, cpos]
    }

    function get_input_element() {
        var input_element_id = $(".autocomplete-list").attr("id").substr(7) // 7 = "aclist_".length
        var input_element = $("#" + input_element_id).get(0)
        return input_element
    }

    function get_field(input_element) {
        var field_uri = input_element.id.substr(6)            // 6 = "field_".length
        var field = get_field(selected_topic, field_uri)
        return field
    }

    /**
     * Moves the viewport of the input element in a way the current cursor position is on-screen.
     * This is done by triggering the space key followed by a backspace.
     */
    function update_viewport(input_element) {
        // space
        var e = document.createEvent("KeyboardEvent");
        e.initKeyEvent("keypress", true, true, null, false, false, false, false, 0, 32);
        input_element.dispatchEvent(e);
        // backspace
        e = document.createEvent("KeyboardEvent");
        e.initKeyEvent("keypress", true, true, null, false, false, false, false, 8, 0);
        input_element.dispatchEvent(e);
    }

    this.lost_focus = function() {
        hide_autocomplete_list("lost focus")
    }

    function show_autocomplete_list(input_element) {
        var pos = $(input_element).position()
        // calculate position
        var top = pos.top + $(input_element).outerHeight()
        var left = pos.left
        // limit size (avoids document growth and thus window scrollbars)
        var max_width = window.innerWidth - left - 26   // leave buffer for vertical document scrollbar
        var max_height = window.innerHeight - top - 2
        //
        $(".autocomplete-list").attr("id", "aclist_" + input_element.id)
        $(".autocomplete-list").css({top: top, left: left})
        $(".autocomplete-list").css({"max-width": max_width, "max-height": max_height, overflow: "hidden"})
        $(".autocomplete-list").empty()
        $(".autocomplete-list").show()
    }

    function hide_autocomplete_list(msg) {
        $(".autocomplete-list").hide()
        autocomplete_item = -1
    }

    function activate_list_item() {
        $(".autocomplete-list a").removeClass("active")
        $(".autocomplete-list a:eq(" + autocomplete_item + ")").addClass("active")
    }

    function item_hovered() {
        autocomplete_item = this.id
        activate_list_item()
    }
}
