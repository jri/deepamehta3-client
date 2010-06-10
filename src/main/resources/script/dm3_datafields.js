/**
 * DeepaMehta 3 core plugin.
 * Handles data fields of type "text", "date", and "relation".
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
                if (!doc.properties[field.id]) {
                    alert("WARNING: Data field \"" + field.id + "\" has no value. Topic:\n" + JSON.stringify(doc))
                }
                return render_text(doc.properties[field.id])
            default:
                alert("render_field_content: unexpected field editor (" + field.view.editor + ")")
            }
            break
        case "date":
            return format_date(doc.properties[field.id])
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
        case "date":
            return render_date_field(field)
        case "relation":
            return render_relation_field(field, doc, rel_topics)
        }

        function render_text_field(field) {
            switch (field.view.editor) {
            case "single line":
                var input = $("<input>").attr({type: "text", id: "field_" + field.id, value: doc.properties[field.id], size: DEFAULT_FIELD_WIDTH})
                if (field.view.autocomplete_indexes) {
                    input.keyup(PlainDocument.prototype.autocomplete)
                    input.blur(PlainDocument.prototype.lost_focus)
                    input.attr({autocomplete: "off"})
                }
                return input
            case "multi line":
                var lines = field.view.lines || DEFAULT_AREA_HEIGHT
                return $("<textarea>").attr({id: "field_" + field.id, rows: lines, cols: DEFAULT_FIELD_WIDTH}).text(doc.properties[field.id])
            default:
                alert("render_text_field: unexpected field editor (" + field.view.editor + ")")
            }
        }

        function render_date_field(field) {
            var input = $("<input>").attr({type: "hidden", id: "field_" + field.id, value: doc.properties[field.id]})
            input.change(function() {
                $("span", $(this).parent()).text(format_date(this.value))
            })
            var date_div = $("<div>")
            date_div.append($("<span>").css("margin-right", "1em").text(format_date(doc.properties[field.id])))
            date_div.append(input)
            input.datepicker({firstDay: 1, showAnim: "fadeIn", showOtherMonths: true, showOn: "button",
                buttonImage: "images/calendar.gif", buttonImageOnly: true, buttonText: "Choose Date"})
            return date_div
        }

        function render_relation_field(field, doc, rel_topics) {
            switch (field.view.editor) {
            case "checkboxes":
                var topics = dms.get_topics(field.model.related_type_id)
                var relation_div = $("<div>")
                for (var i = 0, topic; topic = topics[i]; i++) {
                    var attr = {type: "checkbox", id: topic.id, name: "relation_" + field.id}
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
    }

    this.get_field_content = function(field, doc) {
        switch (field.model.type) {
        case "text":
            switch (field.view.editor) {
            case "single line":
            case "multi line":
                return $.trim($("#field_" + field.id).val())
            default:
                alert("get_field_content: unexpected field editor (" + field.view.editor + ")")
            }
            break
        case "date":
            return $("#field_" + field.id).val()
        case "relation":
            return update_relation_field(field, doc)
        }

        function update_relation_field(field, doc) {
            switch (field.view.editor) {
            case "checkboxes":
                $("input:checkbox[name=relation_" + field.id + "]").each(
                    function() {
                        var checkbox = this
                        var was_checked_before = includes(PlainDocument.prototype.topic_buffer[field.id],
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
                                delete_relation(get_relation_doc(doc.id, checkbox.id).id)
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
