function dm3_types() {

    add_topic_type("Note", {
        fields: [
            {id: "Title", model: {type: "text"}, view: {editor: "single line"}, content: ""},
            {id: "Body",  model: {type: "html"}, view: {editor: "multi line"},  content: ""}
        ],
        view: {
            icon_src: "images/pencil.png"
        },
        implementation: "PlainDocument"
    })
    add_topic_type("Search Result", {
        fields: [
            {id: "Search Term", model: {type: "text"}, view: {editor: "single line"}, content: ""},
        ],
        view: {
            icon_src: "images/bucket.png"
        },
        implementation: "PlainDocument"
    })
}
