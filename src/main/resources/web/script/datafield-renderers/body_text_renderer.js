function BodyTextRenderer(doc, field, rel_topics) {

    this.superclass = HTMLFieldRenderer
    this.superclass(doc, field, rel_topics)

    this.render_field = function(field_value_div) {
        // render field value
        return render_text(get_value(doc, field.uri))
    }
}
