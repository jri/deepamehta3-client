// FIXME: not in use. File to be dropped.

function SearchResult() {
}

SearchResult.prototype = {



    /**************************************************************************************************/
    /**************************************** Overriding Hooks ****************************************/
    /**************************************************************************************************/



    render_document: function(doc) {
        // heading
        var heading = "Search Result " + doc.fields[0].content + " (" + doc.items.length + " documents)"
        $("#detail-panel").append($("<div>").addClass("result-heading").text(heading))
        // result items
        $("#detail-panel").append(render_topic_list(doc.items, this.render_function()))
    },

    context_menu_items: function() {
        return [
            {label: "Remove", handler: "remove"}
        ]
    },



    /************************************************************************************************/
    /**************************************** Custom Methods ****************************************/
    /************************************************************************************************/



    render_function: function() {
    },

    /* Context Menu Commands */

    remove: function() {
        delete_topic(selected_topic)
    }
}
