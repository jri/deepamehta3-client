function dm3_tinymce() {

    this.post_submit_form = function(doc) {
        for (var i = 0, field; field = get_type(doc).fields[i]; i++) {
            if (field.data_type == "html") {
                if (!tinyMCE.execCommand("mceRemoveControl", false, "field_" + field.uri)) {
                    alert("mceRemoveControl not executed")
                } else {
                    // alert("TinyMCE instance removed")
                }
            }
        }
    }
}
