function TextFieldRenderer(doc, field, rel_topics) {

    this.render_field = function() {
        // field label
        render.field_label(field)
        // field value
        return render_text(get_value(doc, field.uri))
    }

    this.render_form_element = function() {
        switch (field.editor) {
        case "single line":
            var input = render.input(doc, field)
            if (field.autocomplete_indexes) {
                var doctype_impl = get_doctype_impl(doc)
                input.keyup(doctype_impl.autocomplete)
                input.blur(doctype_impl.lost_focus)
                input.attr({autocomplete: "off"})
            }
            return input
        case "multi line":
            var lines = field.editor || DEFAULT_AREA_HEIGHT
            return $("<textarea>").attr({
                "field-uri": field.uri, rows: lines, cols: DEFAULT_FIELD_WIDTH
            }).text(get_value(doc, field.uri))
        default:
            alert("WARNING (TextFieldRenderer.render_form_element):\n\nField \"" + field.label +
                "\" has unexpected editor: \"" + field.editor + "\".\n\nfield=" + JSON.stringify(field))
        }
    }

    this.read_form_value = function() {
        switch (field.editor) {
        case "single line":
        case "multi line":
            return $.trim($("[field-uri=" + field.uri + "]").val())
        default:
            alert("get_field_content: unexpected field editor (" + field.editor + ")")
        }
    }
}
