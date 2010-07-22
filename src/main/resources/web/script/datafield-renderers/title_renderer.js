function TitleRenderer(doc, field, rel_topics) {

    this.superclass = TextFieldRenderer
    this.superclass(doc, field, rel_topics)

    this.render_field = function(field_value_div) {
        // render field value
        field_value_div.removeClass("field-value").addClass("title")
        return render_text(get_value(doc, field.uri))
    }
}
