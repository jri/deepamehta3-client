// Settings
var CORE_SERVICE_URI = "/core"
var SEARCH_FIELD_WIDTH = 16    // in chars
var GENERIC_TOPIC_ICON_SRC = "images/gray-dot.png"

var OPEN_LOG_WINDOW = true
var LOG_PLUGIN_LOADING = false
var LOG_IMAGE_LOADING = false
var LOG_AJAX_REQUESTS = false
var LOG_GUI = false

var dms = new DeepaMehtaService(CORE_SERVICE_URI)
var ui = new UIHelper()

var current_doc         // topic document being displayed, or null if no one is currently displayed (a CouchDB document)
var current_rel_id      // ID of relation being activated, or null if no one is currently activated
var canvas              // the canvas that displays the topic map (a Canvas object)
var is_form_shown       // true if a form is shown (used to fire the "post_submit_form" event)
//
var plugin_sources = []
var plugins = []
var doctype_impl_sources = []
var doctype_impls = {}
var css_stylesheets = []
//
var topic_types = {}        // key: Type ID, value: type definition
                            //                      (object with "fields", "view", and "implementation" attributes)
var topic_type_icons = {}   // key: Type ID, value: icon (JavaScript Image object)
var generic_topic_icon = create_image(GENERIC_TOPIC_ICON_SRC)

// log window
if (OPEN_LOG_WINDOW) {
    var log_window = window.open()
}

// --- register core facilities ---
// Note: the core plugins must be registered _before_ the vendor plugins (so, we must not
// put the add_plugin calls in the document ready handler).
// The DM3 Time plugin, e.g. derives its TimeSearchResult from SearchResult (part of
// DM3 Fulltext core plugin). The base class must load first.
doctype_implementation("script/plain_document.js")
add_plugin("script/dm3_fulltext.js")
add_plugin("script/dm3_datafields.js")
add_plugin("script/dm3_tinymce.js")
// css_stylesheet("style/main.css")     // layout flatters while loading

$(document).ready(function() {
    // --- setup GUI ---
    $("#upper-toolbar").addClass("ui-widget-header").addClass("ui-corner-all")
    // the search form
    $("#searchmode-select-placeholder").replaceWith(searchmode_select())
    $("#search_field").attr({size: SEARCH_FIELD_WIDTH})
    $("#search-form").submit(search)
    ui.button("search-button", search, "Search", "gear")
    // the special form
    $("#special-select-placeholder").replaceWith(create_special_select())
    // the document form
    $("#document-form").submit(submit_document)
    detail_panel_width = $("#detail-panel").width()
    log("Detail panel width: " + detail_panel_width)
    //
    canvas = new Canvas()
    //
    load_types()
    //
    // Note: in order to let a plugin DOM manipulate the GUI
    // the plugins must be loaded _after_ the GUI is set up.
    // alert("Plugins:\n" + plugin_sources.join("\n"))
    get_plugins()
    load_plugins()
    //
    trigger_hook("init")
    //
    // the create form
    $("#create-type-menu-placeholder").replaceWith(create_type_menu("create-type-menu").dom)
    ui.button("create-button", create_topic_from_menu, "Create", "plus")
    //
    ui.menu("searchmode-select", searchmode_selected)
    ui.menu("special-select", special_selected, undefined, "Special")
    //
    $(window).resize(window_resized)
    $(window).load(function() {
        $("#detail-panel").height($("#canvas").height())
    })
})

// --- CouchDB API extensions ---

dms.openAttachment = function(docId, attachment_name) {
    this.last_req = this.request("GET", this.uri + encodeURIComponent(docId) + "/" + attachment_name)
    if (this.last_req.status == 404)
        return null
    CouchDB.maybeThrowError(this.last_req)
    return this.last_req.responseText
}

dms.openBinaryAttachment = function(docId, attachment_name) {
    this.last_req = request("GET", this.uri + encodeURIComponent(docId) + "/" + attachment_name)
    if (this.last_req.status == 404)
        return null
    CouchDB.maybeThrowError(this.last_req)
    return to_binary(this.last_req.responseText)

    // Modified (and simplified) version of couch.js's CouchDB.request method to reveive binary data
    function request(method, uri) {
        var req = new XMLHttpRequest()
        req.open(method, uri, false)
        // Overriding the MIME type returned by the server, forcing Firefox to treat it as plain text, using a user-
        // defined character set. This tells Firefox not to parse it, and to let the bytes pass through unprocessed.
        // See https://developer.mozilla.org/En/Using_XMLHttpRequest
        //     https://developer.mozilla.org/en/XMLHttpRequest
        req.overrideMimeType("text/plain; charset=x-user-defined")
        req.send("")
        return req
    }
}

// FIXME: doesn't work. Binary data gets corrupted while PUT.
/* dms.saveBinaryAttachmentAJAX = function(doc, attachment_name, attachment_data) {
    var result = $.ajax({
        async: false,
        contentType: mime_type(attachment_name),
        data: to_binary(attachment_data),
        dataType: "json",
        processData: false,
        type: "PUT",
        url: this.uri + encodeURIComponent(doc.id) + "/" + attachment_name + "?rev=" + doc._rev
    }).responseText
    doc._rev = result.rev
    return result
} */

// FIXME: doesn't work. Binary data gets corrupted while PUT.
// xhr.sendAsBinary() is probably the solution, but exists only in Firefox 3.
/* dms.saveBinaryAttachment = function(doc, attachment_name, attachment_data) {
    var url = this.uri + encodeURIComponent(doc.id) + "/" + attachment_name + "?rev=" + doc._rev
    var binary_data = to_binary(attachment_data)
    var headers = {
        "Content-Length": attachment_data.length,
        "Content-Type": mime_type(attachment_name),
        "Content-Transfer-Encoding": "binary"
    }
    log("Saving attachment " + url)
    log("..... data size: " + attachment_data.length + " bytes, binary size: " + binary_data.length + " bytes")
    log("..... headers=" + JSON.stringify(headers) + " content length=" + attachment_data.length)
    this.last_req = request("PUT", url, {headers: headers, body: binary_data})
    CouchDB.maybeThrowError(this.last_req)
    var result = JSON.parse(this.last_req.responseText)
    doc._rev = result.rev
    return result

    // Modified (and simplified) version of couch.js's CouchDB.request method to send binary data
    function request(method, uri, options) {
        var req = new XMLHttpRequest()
        req.open(method, uri, false)
        if (options.headers) {
            var headers = options.headers
            for (var headerName in headers) {
                if (!headers.hasOwnProperty(headerName)) continue
                req.setRequestHeader(headerName, headers[headerName])
            }
        }
        req.send(options.body)
        return req
    }
} */

//

function window_resized() {
    canvas.rebuild()
    $("#detail-panel").height($("#canvas").height())
}

function searchmode_selected(menu_item) {
    // Note: we must empty the current search widget _before_ the new search widget is build. Otherwise the
    // search widget's event handlers might get lost.
    // Consider this case: the "by Type" searchmode is currently selected and the user selects it again. The
    // ui_menu() call for building the type menu will unnecessarily add the menu to the DOM because it finds
    // an element with the same ID on the page. A subsequent empty() would dispose the just added type menu
    // -- including its event handlers -- and the append() would eventually add the crippled type menu.
    $("#search_widget").empty()
    var searchmode = menu_item.label
    var search_widget = trigger_hook("search_widget", searchmode)[0]
    $("#search_widget").append(search_widget)
}

function search() {
    try {
        //
        var searchmode = ui.menu_item("searchmode-select").label
        var search_topic = trigger_hook("search", searchmode)[0]
        //
        show_document(search_topic.id)
        add_topic_to_canvas(current_doc)
    } catch (e) {
        alert("Error while searching: " + JSON.stringify(e))
    }
    return false
}

function special_selected(menu_item) {
    var command = menu_item.label
    trigger_hook("handle_special_command", command)
}

/**
 * Reveals a document and optionally relate it to the current document.
 *
 * @param   do_relate   Optional (boolean): if true a relation of type "SEARCH_RESULT" is created between
 *                      the document and the current document. If not specified false is assumed.
 */
function reveal_topic(topic_id, do_relate) {
    // error check
    if (!document_exists(topic_id)) {
        alert("Document " + topic_id + " doesn't exist. Possibly it has been deleted.")
        return
    }
    // create relation
    if (do_relate) {
        var relation = dms.get_relation(current_doc.id, topic_id)
        if (!relation) {
            alert("reveal_topic(): create SEARCH_RESULT relation")
            relation = create_relation("SEARCH_RESULT", current_doc.id, topic_id)
        }
        canvas.add_relation(relation.id, relation.src_topic_id, relation.dst_topic_id)
    }
    // reveal document
    show_document(topic_id)
    add_topic_to_canvas(current_doc)
    canvas.focus_topic(topic_id)
}

/**
 * Fetches the document and displays it on the content panel. Updates global state (current_doc),
 * provided the document could be fetched successfully.
 * If no document is specified, the current document is re-fetched.
 * If there is no current document the content panel is emptied.
 *
 * @return  true if the document could be fetched successfully, false otherwise.
 */
function show_document(doc_id) {
    if (doc_id == undefined) {
        if (current_doc) {
            doc_id = current_doc.id
        } else {
            empty_detail_panel()
            return false
        }
    }
    // fetch document
    var doc = dms.get_topic(doc_id)
    //
    if (doc == null) {
        return false
    }
    //
    empty_detail_panel()
    // update global state
    current_doc = doc
    //
    trigger_doctype_hook(current_doc, "render_document", current_doc)
    //
    return true
}

function edit_document() {
    trigger_doctype_hook(current_doc,      "render_form", current_doc)
    trigger_doctype_hook(current_doc, "post_render_form", current_doc)
}

function submit_document() {
    var submit_button = $("#document-form button[submit=true]")
    // alert("submit_document: submit button id=" + submit_button.attr("id"))
    submit_button.click()
    return false
}



/****************************************************************************************/
/**************************************** Topics ****************************************/
/****************************************************************************************/



function create_topic_from_menu() {
    // update DB
    var topic_type = ui.menu_item("create-type-menu").label
    current_doc = create_topic(topic_type)
    // update GUI
    add_topic_to_canvas(current_doc)
    // initiate editing
    edit_document()
}

/**
 * Builds a topic and stores it in the DB.
 *
 * @param   type_id         The topic type ID, e.g. "Note".
 * @param   properties      Optional: topic properties (object, key: field ID, value: content).
 *
 * @return  The topic as stored in the DB.
 */
function create_topic(type_id, properties) {
    var topic = build_topic(type_id, properties)
    return dms.create_topic(topic)
}

/**
 * Builds and returns a topic object.
 *
 * @return  The topic object.
 */
function build_topic(type_id, properties) {
    return {
        type_id: type_id,
        properties: properties || {}
    }
}

/**
 * Deletes a topic (including its relations) from the DB and from the GUI.
 */
function delete_topic(topic_id) {
    // update DB
    dms.delete_topic(topic_id)
    // update GUI
    hide_topic(topic_id)
}

/**
 * Hides a topic (including its relations) from the GUI (canvas & detail panel).
 */
function hide_topic(topic_id) {
    // canvas
    canvas.remove_all_relations_of_topic(topic_id)
    canvas.remove_topic(topic_id, true)           // refresh=true
    // detail panel
    if (topic_id == current_doc.id) {
        current_doc = null
        show_document()
    } else {
        alert("WARNING: removed topic which was not selected\n" +
            "(removed=" + topic_id + " selected=" + current_doc.id + ")")
    }
}



/*******************************************************************************************/
/**************************************** Relations ****************************************/
/*******************************************************************************************/



/**
 * Builds a relation and stores it in the DB.
 *
 * @param   type_id             The relation type ID, e.g. "RELATION", "SEARCH_RESULT".
 * @param   properties          Optional: relation properties (object, key: field ID, value: content).
 *
 * @return  The relation as stored in the DB.
 */
function create_relation(type_id, src_topic_id, dst_topic_id, properties) {
    var relation = build_relation(type_id, src_topic_id, dst_topic_id, properties)
    return dms.create_relation(relation)
}

/**
 * Builds and returns a relation object.
 *
 * @return  The relation object.
 */
function build_relation(type_id, src_topic_id, dst_topic_id, properties) {
    return {
        type_id: type_id,
        src_topic_id: src_topic_id,
        dst_topic_id: dst_topic_id,
        properties: properties || {}
    }
}

/**
 * Deletes a relation from the DB, and from the view (canvas).
 * Note: the canvas view and the detail panel are not refreshed.
 */
function delete_relation(rel_id) {
    // update DB
    dms.delete_relation(rel_id)
    // update GUI
    canvas.remove_relation(rel_id)
}



/************************************************************************************************/
/**************************************** Plugin Support ****************************************/
/************************************************************************************************/



function add_plugin(source_path) {
    plugin_sources.push(source_path)
}

function add_topic_type(type_id, typedef) {
    topic_types[type_id] = typedef
    topic_type_icons[type_id] = create_image(get_icon_src(type_id))
}

function remove_topic_type(type_id) {
    delete topic_types[type_id]
}

function doctype_implementation(source_path) {
    doctype_impl_sources.push(source_path)
}

function css_stylesheet(css_path) {
    css_stylesheets.push(css_path)
}

function javascript_source(source_path) {
    $("head").append($("<script>").attr("src", source_path))
}

/**************************************** Helper ****************************************/

function load_types() {
    var type_ids = dms.get_topic_type_ids()
    for (var i = 0, type_id; type_id = type_ids[i]; i++) {
        var type = dms.get_topic_type(type_id)
        add_topic_type(type_id, type)
    }
}

// Adds server-side plugins to the list of plugins to load at client-side
function get_plugins() {
    var plugins = dms.get_plugins()
    if (LOG_PLUGIN_LOADING) log("Plugins installed at server-side: " + plugins.length)
    for (var i = 0, plugin; plugin = plugins[i]; i++) {
        if (plugin.plugin_file) {
            if (LOG_PLUGIN_LOADING) log("..... plugin \"" + plugin.plugin_id + "\" contains client-side parts -- to be loaded")
            add_plugin("/" + plugin.plugin_id + "/script/" + plugin.plugin_file)
        } else {
            if (LOG_PLUGIN_LOADING) log("..... plugin \"" + plugin.plugin_id + "\" contains no client-side parts -- nothing to load")
        }
    }
}

function load_plugins() {
    // 1) load plugins
    if (LOG_PLUGIN_LOADING) log("Loading " + plugin_sources.length + " plugins:")
    for (var i = 0, plugin_source; plugin_source = plugin_sources[i]; i++) {
        if (LOG_PLUGIN_LOADING) log("..... " + plugin_source)
        javascript_source(plugin_source)
        //
        var plugin_class = basename(plugin_source)
        if (LOG_PLUGIN_LOADING) log(".......... instantiating \"" + plugin_class + "\"")
        plugins.push(new Function("return new " + plugin_class)())
    }
    // 2) load doctype implementations
    if (LOG_PLUGIN_LOADING) log("Loading " + doctype_impl_sources.length + " doctype implementations:")
    for (var i = 0, doctype_impl_src; doctype_impl_src = doctype_impl_sources[i]; i++) {
        load_doctype_impl(doctype_impl_src)
    }
    // 3) load CSS stylesheets
    if (LOG_PLUGIN_LOADING) log("Loading " + css_stylesheets.length + " CSS stylesheets:")
    for (var i = 0, css_stylesheet; css_stylesheet = css_stylesheets[i]; i++) {
        if (LOG_PLUGIN_LOADING) log("..... " + css_stylesheet)
        $("head").append($("<link>").attr({rel: "stylesheet", href: css_stylesheet, type: "text/css"}))
    }
}

function load_doctype_impl(doctype_impl_src) {
    if (LOG_PLUGIN_LOADING) log("..... " + doctype_impl_src)
    javascript_source(doctype_impl_src)
    //
    var doctype_class = to_camel_case(basename(doctype_impl_src))
    if (LOG_PLUGIN_LOADING) log(".......... instantiating \"" + doctype_class + "\"")
    var doctype_impl = new Function("return new " + doctype_class)()
    doctype_impls[doctype_class] = doctype_impl
}

// ---

/**
 * Triggers the named hook of all installed plugins.
 *
 * @param   hook_name   Name of the plugin hook to trigger.
 * @param   <varargs>   Variable number of arguments. Passed to the hook.
 */
function trigger_hook(hook_name) {
    var result = []
    for (var i = 0, plugin; plugin = plugins[i]; i++) {
        if (plugin[hook_name]) {
            // 1) Trigger hook
            if (arguments.length == 1) {
                var res = plugin[hook_name]()
            } else if (arguments.length == 2) {
                var res = plugin[hook_name](arguments[1])
            } else if (arguments.length == 3) {
                var res = plugin[hook_name](arguments[1], arguments[2])
            } else if (arguments.length == 4) {
                var res = plugin[hook_name](arguments[1], arguments[2], arguments[3])
            } else {
                alert("ERROR at trigger_hook: too much arguments (" +
                    (arguments.length - 1) + "), maximum is 3.\nhook=" + hook_name)
            }
            // 2) Store result
            // Note: undefined is not added to the result, but null is.
            // typeof is required because null==undefined !
            if (typeof(res) != "undefined") {
                result.push(res)
            }
        }
    }
    return result
}

function trigger_doctype_hook(doc, hook_name, args) {
    // Lookup implementation
    var doctype_impl = doctype_impls[get_type(doc).implementation]
    // Trigger the hook only if it is defined (a doctype implementation must not define all hooks).
    // alert("trigger_doctype_hook: doctype=" + doctype_impl.name + " hook_name=" + hook_name + " hook=" + doctype_impl[hook_name])
    if (doctype_impl[hook_name]) {
        return doctype_impl[hook_name](args)
    }
}

function call_relation_function(function_name) {
    if (function_name == "delete_relation") {
        // update model
        delete_relation(current_rel_id)
        // update view
        canvas.refresh()
        show_document()
    } else {
        alert("call_relation_function: function \"" + function_name + "\" not implemented")
    }
}

// --- DB ---

function document_exists(doc_id) {
    return dms.get_topic(doc_id) != null
}

// --- GUI ---

function searchmode_select() {
    return $("<select>").attr("id", "searchmode-select")
}

function create_type_menu(menu_id, handler) {
    var type_menu = ui.menu(menu_id, handler)
    for (var type in topic_types) {
        // add type to menu
        type_menu.add_item({label: type, value: type, icon: get_icon_src(type)})
    }
    return type_menu
}

function rebuild_type_menu(menu_id) {
    var selection = ui.menu_item(menu_id).value
    $("#" + menu_id).replaceWith(create_type_menu(menu_id))
    ui.select_menu_item(menu_id, selection)
}

function create_special_select() {
    return $("<select>").attr("id", "special-select")
}

//

/**
 * Adds the topic to the canvas, highlights it, and refreshes the canvas.
 *
 * @param   doc     a topic document
 */
function add_topic_to_canvas(topic) {
    canvas.add_topic(topic.id, topic.type_id, topic_label(topic), true, true)
}

//

/**
 * @param   topics      Topics to render (array of Topic objects).
 */
function render_topic_list(topics, render_function) {
    render_function = render_function || render_topic
    //
    var table = $("<table>")
    for (var i = 0, topic; topic = topics[i]; i++) {
        // icon
        var icon_td = $("<td>").addClass("topic-icon").addClass(i == topics.length - 1 ? "last-topic" : undefined)
        icon_td.append(render_topic_anchor(topic, type_icon_tag(topic.type_id, "type-icon")))
        // label
        var topic_td = $("<td>").addClass("topic-label").addClass(i == topics.length - 1 ? "last-topic" : undefined)
        var list_item = render_function(topic)
        trigger_hook("render_topic_list_item", topic, list_item)
        topic_td.append(list_item)
        //
        table.append($("<tr>").append(icon_td).append(topic_td))
    }
    return table
}

/**
 * @param   topic       Topic to render (a Topic object).
 */
function render_topic(topic) {
    return $("<div>").append(render_topic_anchor(topic, topic.label))
}

/**
 * @param   topic       Topic to render (a Topic object).
 */
function render_topic_anchor(topic, anchor_content) {
    return $("<a>").attr({href: ""}).append(anchor_content).click(function() {
        reveal_topic(topic.id, true)
        return false
    })
}

//

/**
 * @return  The <img> element (jQuery object).
 */
function type_icon_tag(type, css_class) {
    return image_tag(get_icon_src(type), css_class)
}

/**
 * @return  The <img> element (jQuery object).
 */
function image_tag(src, css_class) {
    return $("<img>").attr("src", src).addClass(css_class)
}

/**
 * Returns the icon source for a topic type.
 * If no icon is configured for that type the source of the generic topic icon is returned.
 *
 * @return  The icon source (string).
 */
function get_icon_src(type) {
    // Note: topic_types[type] is undefined if plugin is deactivated and content still exist.
    if (topic_types[type] && topic_types[type].view && topic_types[type].view.icon_src) {
        return topic_types[type].view.icon_src
    } else {
        return GENERIC_TOPIC_ICON_SRC
    }
}

/**
 * Returns the icon for a topic type.
 * If no icon is configured for that type the generic topic icon is returned.
 *
 * @return  The icon (JavaScript Image object)
 */
function get_type_icon(type) {
    var icon = topic_type_icons[type]
    return icon || generic_topic_icon
}

function create_image(src) {
    var img = new Image()
    img.src = src   // Note: if src is a relative URL JavaScript extends img.src to an absolute URL
    img.onload = function(arg0) {
        // Note: "this" is the image. The argument is the "load" event.
        if (LOG_IMAGE_LOADING) log("Image ready: " + src)
        notify_image_trackers()
    }
    return img
}

//

function empty_detail_panel(is_form) {
    if (is_form_shown) {
        trigger_hook("post_submit_form", current_doc)
    }
    is_form_shown = is_form
    //
    $("#detail-panel").empty()
    $("#lower-toolbar").empty()
}

function render_object(object) {
    var table = $("<table>")
    for (var name in object) {
        var td1 = $("<td>").append(name)
        var td2 = $("<td>").append(object[name])
        table.append($("<tr>").append(td1).append(td2))
    }
    return table
}

//

function get_type(topic) {
    return topic_types[topic.type_id]
}

function get_field(doc, field_id) {
    for (var i = 0, field; field = get_type(doc).fields[i]; i++) {
        if (field.id == field_id) {
            return field
        }
    }
}

function get_field_index(doc, field_id) {
    for (var i = 0, field; field = get_type(doc).fields[i]; i++) {
        if (field.id == field_id) {
            return i
        }
    }
}

function remove_field(doc, field_id) {
    var i = get_field_index(doc, field_id)
    // error check 1
    if (i == undefined) {
        alert("ERROR at remove_field: field with ID \"" + field_id +
            "\" not found in fields " + JSON.stringify(doc.fields))
        return
    }
    //
    doc.fields.splice(i, 1)
    // error check 2
    if (get_field_index(doc, field_id) >= 0) {
        alert("ERROR at remove_field: more than one field with ID \"" +
            field_id + "\" found")
        return
    }
}

function get_value(doc, field_id) {
    return get_field(doc, field_id).content
}

/**
 * Returns the label for the topic.
 */
function topic_label(topic) {
    var type = get_type(topic)
    // if there is a view.label_field declaration use the content of that field
    if (type.view) {
        var field_id = type.view.label_field
        if (field_id) {
            return topic.properties[field_id] || ""
        }
    }
    // fallback: use the content of the first field
    return topic.properties[type.fields[0].id] || ""
}

function field_label(field) {
    // Note: the "view" element is optional, e.g. for a "date" field
    return field.view && field.view.label ? field.view.label : field.id
}



// *****************
// *** Utilities ***
// *****************



/**
 * Filters array elements that match a filter function.
 * The array is manipulated in-place.
 */
function filter(array, fn) {
    var i = 0, e
    while (e = array[i]) {
        if (!fn(e)) {
            array.splice(i, 1)
            continue
        }
        i++
    }
}

/**
 * Returns an array containing the keys of the object.
 */
function keys(object) {
    var a = []
    for (var key in object) {
        a.push(key)
    }
    return a
}

function id_list(array) {
    var ids = []
    for (var i = 0, e; e = array[i]; i++) {
        ids.push(e.id)
    }
    return ids
}

function size(object) {
    var size = 0
    for (var key in object) {
        size++
    }
    return size
}

function inspect(object) {
    var str = "\n"
    for (var key in object) {
        str += key + ": " + object[key] + "\n"
    }
    return str
}

/**
 * Returns true if the array contains a positive element according to the indicator function.
 */
function includes(array, fn) {
    for (var i = 0, e; e = array[i]; i++) {
        if (fn(e)) {
            return true
        }
    }
}

/**
 * Substracts array2 from array1.
 */
function substract(array1, array2, fn) {
    filter(array1, function(e1) {
         return !includes(array2, function(e2) {
             return fn(e1, e2)
         })
    })
}

function clone(obj) {
    try {
        return JSON.parse(JSON.stringify(obj))
    } catch (e) {
        alert("ERROR while cloning: " + JSON.stringify(e))
    }
}

function log(text) {
    if (OPEN_LOG_WINDOW) {
        // Note: the log window might be closed meanwhile,
        // or it might not apened at all due to browser security restrictions.
        if (log_window && log_window.document) {
            log_window.document.writeln(render_text(text) + "<br>")
        }
    }
}

// === Text Utilities ===

function render_text(text) {
    // Note: string values are expected
    if (typeof(text) != "string") {
        alert("WARNING: " + text + " is not a string, but a " + typeof(text))
        return text
    }
    return text.replace(/\n/g, "<br>")
}

/**
 * "vendor/dm3-time/script/dm3-time.js" -> "dm3-time"
 */
function basename(path) {
    path.match(/.*\/(.*)\..*/)
    return RegExp.$1
}

function filename_ext(path) {
    return path.substr(path.lastIndexOf(".") + 1)
}

function to_camel_case(str) {
    var res = ""
    var words = str.split("_")
    for (var i = 0, word; word = words[i]; i++) {
        res += word[0].toUpperCase()
        res += word.substr(1)
    }
    return res
}

/**
 * "Type ID" -> "type-id"
 */
function to_id(str) {
    str = str.toLowerCase()
    str = str.replace(/ /g, "-")
    return str
}

/**
 * @param   date    the date to format (string). If empty (resp. evaluates to false) an empty string is returned.
 *                  Otherwise it must be parsable by the Date constructor, e.g. "12/30/2009".
 */
function format_date(date) {
    // For possible format strings see http://docs.jquery.com/UI/Datepicker/formatDate
    return date ? $.datepicker.formatDate("D, M d, yy", new Date(date)) : ""
}

function mime_type(path) {
    switch (filename_ext(path)) {
    case "gif":
        return "image/gif"
    case "jpg":
        return "image/jpeg"
    case "png":
        return "image/png"
    default:
        alert("ERROR at mime_type: unexpected file type (" + path + ")")
    }
}

function to_binary(str) {
    var binary = ""
    for (var i = 0; i < str.length; i++) {
        binary += String.fromCharCode(str.charCodeAt(i) & 0xFF)
    }
    return binary
}

/*** Helper Classes ***/

function Topic(id, type, label) {
    this.id = id
    this.type = type
    this.label = label
}

function Relation(id, type, doc1_id, doc2_id) {
    this.id = id
    this.type = type
    this.doc1_id = doc1_id
    this.doc2_id = doc2_id
}

// === Image Tracker ===

var image_tracker

function create_image_tracker(callback_func) {

    return image_tracker = new ImageTracker()

    function ImageTracker() {

        var types = []      // topic types whose images are tracked

        this.add_type = function(type) {
            if (types.indexOf(type) == -1) {
                types.push(type)
            }
        }

        // Checks if the tracked images are loaded completely.
        // If so, the callback is triggered and this tracker is removed.
        this.check = function() {
            if (types.every(function(type) {return get_type_icon(type).complete})) {
                callback_func()
                image_tracker = undefined
            }
        }
    }
}

function notify_image_trackers() {
    image_tracker && image_tracker.check()
}

// === Cookie Support ===

function set_cookie(key, value) {
    document.cookie = key + "=" + value + ";path=" + CORE_SERVICE_URI
}
