function dm3_default () {

    // ------------------------------------------------------------------------------------------------ Overriding Hooks

    this.init = function() {

        ui.dialog("delete-topic-dialog",    "Delete Topic?",    "Delete", do_delete_topic)
        ui.dialog("delete-relation-dialog", "Delete Relation?", "Delete", do_delete_relation)

        function do_delete_topic() {
            $("#delete-topic-dialog").dialog("close")
            delete_topic(selected_topic)
        }

        function do_delete_relation() {
            $("#delete-relation-dialog").dialog("close")
            // update model
            delete_relation(current_rel_id)
            // update view
            canvas.refresh()
            render_topic()
        }
    }

    this.add_topic_commands = function(topic) {

        return [
            {label: "Hide",   handler: do_hide,       context: "context-menu"},
            {label: "Relate", handler: do_relate,     context: "context-menu"},
            {is_separator: true,                      context: "context-menu"},
            {label: "Delete", handler: do_confirm,    context: "context-menu"},
            {label: "Edit",   handler: edit_document, context: "detail-panel-show", ui_icon: "pencil"},
            {label: "Save",   handler: do_save,       context: "detail-panel-edit", ui_icon: "circle-check",
                                                                                    is_submit: true},
            {label: "Cancel", handler: do_cancel,     context: "detail-panel-edit"}
        ]

        function do_hide() {
            hide_topic(topic.id)
        }

        function do_relate(event) {
            canvas.begin_relation(topic.id, event)
        }

        function do_confirm() {
            $("#delete-topic-dialog").dialog("open")
        }

        function do_save() {
            trigger_doctype_hook(topic, "process_form")
        }

        function do_cancel() {
            trigger_hook("post_submit_form", topic)
            render_topic()
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
            hide_relation(relation.id)
            // update view
            canvas.refresh()
        }

        function do_confirm() {
            $("#delete-relation-dialog").dialog("open")
        }
    }
}
