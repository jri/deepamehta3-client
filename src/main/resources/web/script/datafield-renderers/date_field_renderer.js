function DateFieldRenderer(doc, field, rel_topics) {

    this.render_field = function() {
        // field label
        render.field_label(field)
        // field value
        return format_date(get_value(doc, field.uri))
    }

    this.render_form_element = function() {
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

    this.read_form_value = function() {
        return $("[field-uri=" + field.uri + "]").val()
    }
}
