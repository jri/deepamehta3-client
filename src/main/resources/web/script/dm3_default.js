function dm3_default () {

    // ------------------------------------------------------------------------------------------------ Overriding Hooks

    this.init = function() {
        ui.dialog("delete-topic-dialog", "Delete Topic?", "Delete", do_delete_topic)
        ui.dialog("delete-relation-dialog", "Delete Relation?", "Delete", do_delete_relation)
    }

    this.add_commands = function(context) {
        switch (context) {
        case "topic":
            return [
                {label: "Hide",   handler: do_hide_topic},
                {label: "Relate", handler: do_relate},
                "---",
                {label: "Delete", handler: do_confirm_delete_topic}      // as button had "ui-icon-trash"
            ]
        case "relation":
            return [
                {label: "Delete", handler: do_confirm_delete_relation}
            ]
        case "canvas":
            break
        case "detail panel show":
            return [
                {label: "Edit", handler: edit_document, ui_icon: "pencil"}
            ]
        case "detail panel edit":
            return [
                {label: "Save", handler: do_save, ui_icon: "circle-check", is_submit: true},
                {label: "Cancel", handler: do_cancel_editing}
            ]
        }
    }

    // ----------------------------------------------------------------------------------------------- Private Functions

    /*** Topic Commands ***/

    function do_hide_topic() {
        hide_topic(selected_topic.id)
    }

    function do_relate(event) {
        canvas.begin_relation(selected_topic.id, event)
    }

    function do_confirm_delete_topic() {
        $("#delete-topic-dialog").dialog("open")
    }

    function do_delete_topic() {
        $("#delete-topic-dialog").dialog("close")
        delete_topic(selected_topic)
    }

    /*** Relation Commands ***/

    function do_confirm_delete_relation() {
        $("#delete-relation-dialog").dialog("open")
    }

    function do_delete_relation() {
        $("#delete-relation-dialog").dialog("close")
        // update model
        delete_relation(current_rel_id)
        // update view
        canvas.refresh()
        render_topic()
    }

    /*** Detail Panel Commands ***/

    function do_save() {
        trigger_doctype_hook(selected_topic, "process_form")
    }

    function do_cancel_editing() {
        //
        trigger_hook("post_submit_form", selected_topic)
        //
        render_topic()
    }
}
