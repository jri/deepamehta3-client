/**
 * Abstract base class for widgets that render a topicmap.
 */
function TopicmapRenderer() {

    // ------------------------------------------------------------------------------------------------------ Public API

    /**
     * @param   highlight_topic     Optional: if true, the topic is highlighted.
     * @param   refresh_canvas      Optional: if true, the canvas is refreshed.
     * @param   x                   Optional
     * @param   y                   Optional
     */
    this.add_topic = function(id, type, label, highlight_topic, refresh_canvas, x, y) {}

    this.add_relation = function(id, doc1_id, doc2_id, refresh_canvas) {}

    this.remove_topic = function(id, refresh_canvas, is_part_of_delete_operation) {}

    /**
     * Removes a relation from the canvas (model) and optionally refreshes the canvas (view).
     * If the relation is not present on the canvas nothing is performed.
     *
     * @param   refresh_canvas  Optional - if true, the canvas is refreshed.
     */
    this.remove_relation = function(id, refresh_canvas, is_part_of_delete_operation) {}

    this.remove_all_relations_of_topic = function(topic_id, is_part_of_delete_operation) {}

    this.set_topic_label = function(id, label) {}

    this.scroll_topic_to_center = function(topic_id) {}

    this.refresh = function() {}

    this.close_context_menu = function() {}

    this.begin_relation = function(doc_id, event) {}

    this.clear = function() {}

    this.adjust_size = function() {}

    /*** Grid Positioning ***/

    this.start_grid_positioning = function() {}

    this.stop_grid_positioning = function() {}

    // -------------------------------------------------------------------------------------------- Protected Properties

    this.canvas_width  = 0      // reflects canvas width (in pixel)
    this.canvas_height = 0      // reflects canvas height (in pixel)

    // ----------------------------------------------------------------------------------------------- Protected Methods

    this.calculate_size = function() {
        var w_w = window.innerWidth
        var w_h = window.innerHeight
        var t_h = $("#upper-toolbar").height()
        this.canvas_width = w_w - detail_panel_width - 50    // 35px = 1.2em + 2 * 8px = 19(.2)px + 16px.
                                            // Update: Safari 4 needs 15 extra pixel (for potential vertical scrollbar?)
        this.canvas_height = w_h - t_h - 76 // was 60, then 67 (healing login dialog), then 76 (healing datepicker)
        if (dm3c.LOG_GUI) {
            dm3c.log("Calculating canvas size: window size=" + w_w + "x" + w_h + " toolbar height=" + t_h)
            dm3c.log("..... new canvas size=" + this.canvas_width + "x" + this.canvas_height)
        }
    }
}
