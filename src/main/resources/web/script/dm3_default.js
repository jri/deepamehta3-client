function dm3_default () {

    // ------------------------------------------------------------------------------------------------ Overriding Hooks

    this.add_commands = function(context) {
        switch (context) {
        case "topic":
            return [
                {label: "Hide",   handler: do_hide_topic},
                {label: "Relate", handler: do_relate}
            ]
        case "relation":
            return [
                {label: "Delete", handler: do_delete_relation}
            ]
        case "canvas":
            break
        case "detail panel":
            break
        }
    }

    // ----------------------------------------------------------------------------------------------- Private Functions

    function do_hide_topic() {
        hide_topic(selected_topic.id)
    }

    function do_relate(event) {
        canvas.begin_relation(selected_topic.id, event)
    }

    function do_delete_relation() {
        // update model
        delete_relation(current_rel_id)
        // update view
        canvas.refresh()
        render_topic()
    }
}
