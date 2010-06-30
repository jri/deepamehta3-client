/**
 * DeepaMehta 3 core plugin.
 * Handles data fields of type "text", "number", "date", and "relation".
 */
function dm3_datafields() {



    /**************************************************************************************************/
    /**************************************** Overriding Hooks ****************************************/
    /**************************************************************************************************/



    this.render_field_content = function(field, doc, rel_topics) {
        switch (field.model.type) {
        case "text":
            switch (field.view.editor) {
            case "single line":
            case "multi line":
                return render_text(get_value(doc, field.uri))
            default:
                alert("render_field_content: unexpected field editor (" + field.view.editor + ")")
            }
            break
        case "number":
            return get_value(doc, field.uri)
        case "date":
            return format_date(get_value(doc, field.uri))
        case "relation":
            switch (field.view.editor) {
            case "checkboxes":
                return render_topic_list(rel_topics)
            }
        }
    }

    this.render_form_field = function(field, doc, rel_topics) {

        switch (field.model.type) {
        case "text":
            return render_text_field(field)
        case "number":
            return render_number_field(field)
        case "date":
            return render_date_field(field)
        case "relation":
            return render_relation_field(field, doc, rel_topics)
        }

        function render_text_field(field) {
            switch (field.view.editor) {
            case "single line":
                var input = render_input()
                if (field.view.autocomplete_indexes) {
                    var doctype_impl = get_doctype_impl(doc)
                    input.keyup(doctype_impl.autocomplete)
                    input.blur(doctype_impl.lost_focus)
                    input.attr({autocomplete: "off"})
                }
                return input
            case "multi line":
                var lines = field.view.lines || DEFAULT_AREA_HEIGHT
                return $("<textarea>").attr({
                    "field-uri": field.uri, rows: lines, cols: DEFAULT_FIELD_WIDTH
                }).text(get_value(doc, field.uri))
            default:
                alert("render_text_field: unexpected field editor (" + field.view.editor + ")")
            }
        }

        function render_number_field(field) {
            return render_input()
        }

        function render_date_field(field) {
            var input = $("<input>").attr({type: "hidden", "field-uri": field.uri, value: get_value(doc, field.uri)})
            input.change(function() {
                $("span", $(this).parent()).text(format_date(this.value))
            })
            var date_div = $("<div>")
            date_div.append($("<span>").css("margin-right", "1em").text(format_date(get_value(doc, field.uri))))
            date_div.append(input)
            input.datepicker({firstDay: 1, showAnim: "fadeIn", showOtherMonths: true, showOn: "button",
                buttonImage: "images/calendar.gif", buttonImageOnly: true, buttonText: "Choose Date"})
            return date_div
        }

        function render_relation_field(field, doc, rel_topics) {
            switch (field.view.editor) {
            case "checkboxes":
                var topics = dmc.get_topics(field.model.related_type_uri)
                var relation_div = $("<div>")
                for (var i = 0, topic; topic = topics[i]; i++) {
                    var attr = {type: "checkbox", id: topic.id, name: "relation_" + field.uri}
                    if (includes(rel_topics, function(t) {
                            return t.id == topic.id
                        })) {
                        attr.checked = "checked"
                    }
                    relation_div.append($("<label>").append($("<input>").attr(attr)).append(topic.label))
                }
                return relation_div
            }
        }

        // --- Helper ---

        function render_input() {
            return $("<input>").attr({
                type: "text", "field-uri": field.uri, value: get_value(doc, field.uri), size: DEFAULT_FIELD_WIDTH
            })
        }
    }

    this.get_field_content = function(field, doc) {
        switch (field.model.type) {
        case "text":
            switch (field.view.editor) {
            case "single line":
            case "multi line":
                return $.trim($("[field-uri=" + field.uri + "]").val())
            default:
                alert("get_field_content: unexpected field editor (" + field.view.editor + ")")
            }
            break
        case "number":
            var val = $("[field-uri=" + field.uri + "]").val()
            var content = Number(val)
            if (isNaN(content)) {
                alert("WARNING: " + val + " is not a number (field \"" + field.uri + "\"). The old value is restored.")
                return null     // prevent this field from being updated
            }
            return content
        case "date":
            return $("[field-uri=" + field.uri + "]").val()
        case "relation":
            return update_relation_field(field, doc)
        }

        // TODO: updating relation fields should run at server-side (in a transaction)
        function update_relation_field(field, doc) {
            switch (field.view.editor) {
            case "checkboxes":
                $("input:checkbox[name=relation_" + field.uri + "]").each(
                    function() {
                        var checkbox = this
                        var was_checked_before = includes(get_doctype_impl(doc).topic_buffer[field.uri],
                            function(topic) {
                                return topic.id == checkbox.id
                            }
                        )
                        if (checkbox.checked) {
                            if (!was_checked_before) {
                                create_relation("RELATION", doc.id, checkbox.id)
                            }
                        } else {
                            if (was_checked_before) {
                                delete_relation(dmc.get_relation(doc.id, checkbox.id).id)
                            }
                        }
                    }
                )
                // prevent this field from being updated
                return null
            }
        }
    }



    /************************************************************************************************/
    /**************************************** Custom Methods ****************************************/
    /************************************************************************************************/



}
