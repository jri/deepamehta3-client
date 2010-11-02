function dm3_default () {

    // ------------------------------------------------------------------------------------------------ Overriding Hooks

    this.init = function() {

        dm3c.ui.dialog("delete-topic-dialog",    "Delete Topic?",    "Delete", do_delete_topic)
        dm3c.ui.dialog("delete-relation-dialog", "Delete Relation?", "Delete", do_delete_relation)

        function do_delete_topic() {
            $("#delete-topic-dialog").dialog("close")
            dm3c.delete_topic(dm3c.selected_topic)
        }

        function do_delete_relation() {
            $("#delete-relation-dialog").dialog("close")
            // update model
            dm3c.delete_relation(dm3c.current_rel_id)
            // update view
            dm3c.canvas.refresh()
            dm3c.render_topic()
        }
    }

    this.add_topic_commands = function(topic) {

        var commands = []
        //
        commands.push({label: "Hide",   handler: do_hide,   context: "context-menu"})
        commands.push({label: "Relate", handler: do_relate, context: "context-menu"})
        //
        var result = dm3c.trigger_hook("has_write_permission", topic)
        if (!js.contains(result, false)) {
            commands.push({label: "Edit",   handler: do_edit,    context: "detail-panel-show", ui_icon: "pencil"})
            commands.push({label: "Delete", handler: do_confirm, context: "detail-panel-show", ui_icon: "trash"})
        }
        //
        commands.push({label: "Save",   handler: do_save,   context: "detail-panel-edit", ui_icon: "circle-check",
                                                                                          is_submit: true})
        commands.push({label: "Cancel", handler: do_cancel, context: "detail-panel-edit"})
        //
        return commands

        function do_hide() {
            dm3c.hide_topic(topic.id)
        }

        function do_relate(event) {
            dm3c.canvas.begin_relation(topic.id, event)
        }

        function do_edit() {
            dm3c.edit_topic(topic)
        }

        function do_confirm() {
            $("#delete-topic-dialog").dialog("open")
        }

        function do_save() {
            var result = dm3c.trigger_hook("pre_submit_form", dm3c.selected_topic)
            if (!js.contains(result, false)) {
                dm3c.trigger_doctype_hook(topic, "process_form", topic)
            } else {
                alert("submit is prohibited by plugin") // FIXME: drop this
            }
        }

        function do_cancel() {
            dm3c.trigger_hook("post_submit_form", topic)
            dm3c.render_topic()
        }
    }

    this.add_relation_commands = function(relation) {

        return [
            {label: "Hide",   handler: do_hide,    context: "context-menu"},
            {is_separator: true,                   context: "context-menu"},
            {label: "Delete", handler: do_confirm, context: "context-menu"}
        ]

        function do_hide() {
            // update model
            dm3c.hide_relation(relation.id)
            // update view
            dm3c.canvas.refresh()
        }

        function do_confirm() {
            $("#delete-relation-dialog").dialog("open")
        }
    }
}
