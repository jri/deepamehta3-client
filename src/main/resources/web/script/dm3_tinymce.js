function dm3_tinymce() {

    tinymce_options = {
        theme: "advanced",
        content_css: "style/tinymce.css",
        plugins: "autoresize",
        extended_valid_elements: "iframe[align<bottom?left?middle?right?top|class|frameborder|height|id|" +
            "longdesc|marginheight|marginwidth|name|scrolling<auto?no?yes|src|style|title|width]",
        // Theme options
        theme_advanced_buttons1: "formatselect,|,bullist,numlist,|,bold,italic,underline,|,link,unlink,anchor,|," +
            "image,code,|,undo,redo",
        theme_advanced_buttons2: "fontselect,fontsizeselect,forecolor,backcolor",
        theme_advanced_buttons3: "",
        theme_advanced_blockformats: "h1,h2,h3,p",
        theme_advanced_toolbar_location: "top",
        theme_advanced_toolbar_align: "left"
    }



    /**************************************************************************************************/
    /**************************************** Overriding Hooks ****************************************/
    /**************************************************************************************************/



    this.render_field_content = function(field, doc) {
        if (field.model.type == "html") {
            return doc.properties[field.id]
        }
    }

    this.render_form_field = function(field, doc) {
        if (field.model.type == "html") {
            var lines = field.view.lines || DEFAULT_AREA_HEIGHT
            var textarea = $("<textarea>")
            textarea.attr({id: "field_" + field.id, rows: lines, cols: DEFAULT_FIELD_WIDTH})
            textarea.text(doc.properties[field.id])
            return textarea
        }
    }

    this.post_render_form_field = function(field) {
        if (field.model.type == "html") {
            tinymce_options.window = window
            tinymce_options.element_id = "field_" + field.id
            if (!tinyMCE.execCommand("mceAddFrameControl", false, tinymce_options)) {
                alert("mceAddFrameControl not executed")
            }
        }
    }

    this.get_field_content = function(field) {
        if (field.model.type == "html") {
            return tinyMCE.get("field_" + field.id).getContent()
        }
    }

    this.post_submit_form = function(doc) {
        for (var i = 0, field; field = get_type(doc).fields[i]; i++) {
            if (field.model.type == "html") {
                if (!tinyMCE.execCommand("mceRemoveControl", false, "field_" + field.id)) {
                    alert("mceRemoveControl not executed")
                }
            }
        }
    }
}
