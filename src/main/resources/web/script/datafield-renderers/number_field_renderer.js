function NumberFieldRenderer(doc, field, rel_topics) {

    this.render_field = function() {
        // field label
        render.field_label(field)
        // field value
        return get_value(doc, field.uri)
    }

    this.render_form_element = function() {
        return render.input(doc, field)
    }

    this.read_form_value = function() {
        var val = $("[field-uri=" + field.uri + "]").val()
        var content = Number(val)
        if (isNaN(content)) {
            alert("WARNING: " + val + " is not a number (field \"" + field.uri + "\"). The old value is restored.")
            return null     // prevent this field from being updated
        }
        return content
    }
}
