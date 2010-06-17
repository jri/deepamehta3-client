function dm3_fulltext() {

    // FIXME: doctype search_result not in use
    doctype_implementation("script/search_result.js")
    css_stylesheet("style/search_result.css")

    this.init = function() {
        $("#searchmode-select").append($("<option>").text("By Text"))
    }

    this.search_widget = function(searchmode) {
        if (searchmode == "By Text") {
            return $("<input>").attr({id: "search_field", type: "text", size: SEARCH_FIELD_WIDTH})
        }
    }

    this.search = function(searchmode) {
        if (searchmode == "By Text") {
            var searchterm = $.trim($("#search_field").val())
            return dms.search_topics("search", searchterm)
        }
    }
}
