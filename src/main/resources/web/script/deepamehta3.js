// Settings
var CORE_SERVICE_URI = "/core"
var SEARCH_FIELD_WIDTH = 16    // in chars
var UPLOAD_DIALOG_WIDTH = "50em"
var GENERIC_TOPIC_ICON_SRC = "images/gray-dot.png"

var EXCLUDE_TYPES_FROM_MENUS = [
    "de/deepamehta/core/topictype/Workspace",
    "de/deepamehta/core/topictype/Topicmap",
    "de/deepamehta/core/topictype/Icon",
    "de/deepamehta/core/topictype/SearchResult",
    "de/deepamehta/core/topictype/TopicmapRelationRef",
    "de/deepamehta/core/topictype/Plugin"
]

var ENABLE_LOGGING = false
var LOG_PLUGIN_LOADING = false
var LOG_IMAGE_LOADING = false
var LOG_AJAX_REQUESTS = false
var LOG_GUI = false

var dmc = new DeepaMehtaClient(CORE_SERVICE_URI)
var ui = new UIHelper()
var render = new RenderHelper()

var selected_topic      // topic being displayed, or null if no one is currently displayed (a Topic object)
var current_rel_id      // ID of relation being activated, or null if no one is currently activated
var canvas              // the canvas that displays the topic map (a Canvas object)
//
var plugin_sources = []
var plugins = {}            // key: plugin class, value: plugin instance
var doctype_impl_sources = []
var doctype_impls = {}
var field_renderer_sources = []
var css_stylesheets = []
//
var topic_types = {}        // key: Type URI, value: type definition
                            //                (object with "uri", "fields", "view", and "js_renderer_class" attributes)
var topic_type_icons = {}   // key: Type URI, value: icon (JavaScript Image object)
var generic_topic_icon = create_image(GENERIC_TOPIC_ICON_SRC)

// log window
if (ENABLE_LOGGING) {
    var log_window = window.open()
}

// --- register default modules ---
register_doctype_renderer("script/plain_document.js")
//
register_field_renderer("script/datafield-renderers/text_field_renderer.js")
register_field_renderer("script/datafield-renderers/number_field_renderer.js")
register_field_renderer("script/datafield-renderers/date_field_renderer.js")
register_field_renderer("script/datafield-renderers/html_field_renderer.js")
register_field_renderer("script/datafield-renderers/reference_field_renderer.js")
//
register_field_renderer("script/datafield-renderers/title_renderer.js")
register_field_renderer("script/datafield-renderers/body_text_renderer.js")
//
register_plugin("script/dm3_default.js")
register_plugin("script/dm3_fulltext.js")
register_plugin("script/dm3_tinymce.js")
// css_stylesheet("style/main.css")     // layout flatters while loading

$(function() {
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
    if (LOG_GUI) log("Detail panel width: " + detail_panel_width)
    // The upload dialog
    $("#upload-dialog").dialog({
        modal: true, autoOpen: false, draggable: false, resizable: false, width: UPLOAD_DIALOG_WIDTH
    })
    //
    canvas = new Canvas()
    //
    extend_rest_client()
    //
    load_types()
    //
    // Note: in order to let a plugin DOM manipulate the GUI
    // the plugins must be loaded _after_ the GUI is set up.
    register_plugins()
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

    function extend_rest_client() {

        dmc.search_topics_and_create_bucket = function(text, field_uri, whole_word) {
            var params = this.createRequestParameter({search: text, field: field_uri, wholeword: whole_word})
            return this.request("GET", "/client/search" + params.to_query_string())
        }

        // Note: this method is actually part of the Type Search plugin.
        // TODO: proper modulariuation. Either let the Type Search plugin provide its own REST resource (with
        // another namespace again) or make the Type Search plugin an integral part of the Client plugin.
        dmc.get_topics_and_create_bucket = function(type_uri) {
            return this.request("GET", "/client/search/by_type/" + encodeURIComponent(type_uri))
        }
    }

    function window_resized() {
        canvas.rebuild()
        $("#detail-panel").height($("#canvas").height())
    }
})

function searchmode_selected(menu_item) {
    // Note: we must empty the current search widget _before_ the new search widget is build. Otherwise the
    // search widget's event handlers might get lost.
    // Consider this case: the "by Type" searchmode is currently selected and the user selects it again. The
    // ui_menu() call for building the type menu will unnecessarily add the menu to the DOM because it finds
    // an element with the same ID on the page. A subsequent empty() would dispose the just added type menu
    // -- including its event handlers -- and the append() would eventually add the crippled type menu.
    $("#search-widget").empty()
    var searchmode = menu_item.label
    var search_widget = trigger_hook("search_widget", searchmode)[0]
    $("#search-widget").append(search_widget)
}

function search() {
    try {
        var searchmode = ui.menu_item("searchmode-select").label
        var search_topic = trigger_hook("search", searchmode)[0]
        add_topic_to_canvas(search_topic, "show")
    } catch (e) {
        alert("ERROR while searching:\n\n" + JSON.stringify(e))
    }
    return false
}

function special_selected(menu_item) {
    var command = menu_item.label
    trigger_hook("handle_special_command", command)
}

/**
 * Reveals a topic and optionally relates the selected topic to it.
 *
 * @param   do_relate   Optional (boolean): if evaluates to true a relation of type "SEARCH_RESULT"
 *                      is created between the selected topic and the revealed topic.
 */
function reveal_topic(topic_id, do_relate) {
    // error check
    if (!document_exists(topic_id)) {
        alert("Topic " + topic_id + " doesn't exist. Possibly it has been deleted.")
        return
    }
    // create relation
    if (do_relate) {
        var relation = dmc.get_relation(selected_topic.id, topic_id)
        if (!relation) {
            alert("reveal_topic(): create SEARCH_RESULT relation")
            relation = create_relation("SEARCH_RESULT", selected_topic.id, topic_id)
        }
        canvas.add_relation(relation.id, relation.src_topic_id, relation.dst_topic_id)
    }
    // reveal topic
    add_topic_to_canvas(dmc.get_topic(topic_id), "show")
    canvas.scroll_topic_to_center(topic_id)
}

/**
 * Adds a topic to the canvas, and refreshes the detail panel according to the specified action.
 *
 * High-level utility method for plugin developers.
 * Note: the topic must exist in the DB already. Possibly call create_topic() before.
 *
 * @param   topic       Topic to add (a Topic object).
 * @param   action      Optional: action to perform, 3 possible values:
 *                      "none" - do not select the topic (detail panel doesn't change) -- the default.
 *                      "show" - select the topic and show its info in the detail panel.
 *                      "edit" - select the topic and show its form in the detail panel.
 */
function add_topic_to_canvas(topic, action) {
    action = action || "none"   // set default
    // update canvas
    var highlight = action != "none"
    canvas.add_topic(topic.id, topic.type_uri, topic_label(topic), highlight, true)
    // update detail panel
    switch (action) {
    case "none":
        break
    case "show":
        render_topic(topic.id)
        break
    case "edit":
        // update global state
        selected_topic = topic
        //
        edit_document()
        break
    default:
        alert("WARNING (add_topic_to_canvas):\n\nUnexpected action: \"" + action + "\"")
    }
}

/**
 * Fetches the topic and displays it on the detail panel.
 * Updates global state (selected_topic).
 * If no topic is specified, the selected topic is re-fetched.
 * If there is no selected topic the detail panel is emptied.
 */
function render_topic(doc_id) {
    if (doc_id == undefined) {
        if (selected_topic) {
            doc_id = selected_topic.id
        } else {
            empty_detail_panel()
            return
        }
    }
    // fetch topic
    var topic = dmc.get_topic(doc_id)
    // update global state
    selected_topic = topic
    //
    trigger_doctype_hook(selected_topic, "render_document", selected_topic)
}

function edit_document() {
    trigger_doctype_hook(selected_topic, "render_form", selected_topic)
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



/**
 * Builds a topic and stores it in the DB.
 *
 * @param   type_uri        The topic type URI, e.g. "de/deepamehta/core/topictype/Note".
 * @param   properties      Optional: topic properties (object, key: field ID, value: content).
 *
 * @return  The topic as stored in the DB.
 */
function create_topic(type_uri, properties) {
    var topic = {
        type_uri: type_uri,
        properties: properties || {}
    }
    return dmc.create_topic(topic)
}

function update_topic(topic, old_properties) {
    // update DB
    dmc.set_topic_properties(topic.id, topic.properties)
    // trigger hook
    trigger_hook("post_update_topic", topic, old_properties)
}

/**
 * Deletes a topic (including its relations) from the DB and from the GUI.
 */
function delete_topic(topic) {
    // update DB
    dmc.delete_topic(topic.id)
    // trigger hook
    trigger_hook("post_delete_topic", topic)
    // update GUI
    hide_topic(topic.id, true)
}

/**
 * Hides a topic (including its relations) from the GUI (canvas & detail panel).
 */
function hide_topic(topic_id, is_part_of_delete_operation) {
    // canvas
    canvas.remove_all_relations_of_topic(topic_id)
    canvas.remove_topic(topic_id, true, is_part_of_delete_operation)    // refresh=true
    // detail panel
    if (topic_id == selected_topic.id) {
        selected_topic = null
        render_topic()
    } else {
        alert("WARNING: removed topic which was not selected\n" +
            "(removed=" + topic_id + " selected=" + selected_topic.id + ")")
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
    var relation = {
        type_id: type_id,
        src_topic_id: src_topic_id,
        dst_topic_id: dst_topic_id,
        properties: properties || {}
    }
    return dmc.create_relation(relation)
}

/**
 * Deletes a relation from the DB, and from the view (canvas).
 * Note: the canvas view and the detail panel are not refreshed.
 */
function delete_relation(rel_id) {
    // update DB
    dmc.delete_relation(rel_id)
    // update GUI
    canvas.remove_relation(rel_id)
}



/***************************************************************************************/
/**************************************** Types ****************************************/
/***************************************************************************************/



/**
 * Creates a topic type in the DB.
 *
 * @param   type_uri        The topic type URI, e.g. "de/deepamehta/core/topictype/Note".
 * @param   properties      Optional: topic properties (object, key: field ID, value: content).
 *
 * @return  The topic view of the created topic type.
 */
function create_topic_type(topic_type) {
    // update DB
    var tt = dmc.create_topic_type(topic_type);
    // trigger hook
    trigger_hook("post_create_topic", tt)
    //
    return tt
}



/************************************************************************************************/
/**************************************** Plugin Support ****************************************/
/************************************************************************************************/



function register_plugin(source_path) {
    plugin_sources.push(source_path)
}

function register_doctype_renderer(source_path) {
    doctype_impl_sources.push(source_path)
}

function register_field_renderer(source_path) {
    field_renderer_sources.push(source_path)
}

function css_stylesheet(css_path) {
    css_stylesheets.push(css_path)
}

function javascript_source(source_path) {
    $("head").append($("<script>").attr("src", source_path))
}

/**************************************** Helper ****************************************/

function load_types() {
    var type_uris = dmc.get_topic_type_uris()
    for (var i = 0; i < type_uris.length; i++) {
        var type_uri = type_uris[i]
        var type = dmc.get_topic_type(type_uri)
        add_topic_type(type_uri, type)
    }
}

/**
 * Registers server-side plugins to the list of plugins to load at client-side.
 */
function register_plugins() {
    var plugins = dmc.get_plugins()
    if (LOG_PLUGIN_LOADING) log("Plugins installed at server-side: " + plugins.length)
    for (var i = 0, plugin; plugin = plugins[i]; i++) {
        if (plugin.plugin_file) {
            if (LOG_PLUGIN_LOADING) log("..... plugin \"" + plugin.plugin_id +
                "\" contains client-side parts -- to be loaded")
            register_plugin("/" + plugin.plugin_id + "/script/" + plugin.plugin_file)
        } else {
            if (LOG_PLUGIN_LOADING) log("..... plugin \"" + plugin.plugin_id +
                "\" contains no client-side parts -- nothing to load")
        }
    }
}

function load_plugins() {
    // 1) load plugins
    if (LOG_PLUGIN_LOADING) log("Loading " + plugin_sources.length + " plugins:")
    for (var i = 0, plugin_source; plugin_source = plugin_sources[i]; i++) {
        load_plugin(plugin_source)
    }
    // 2) load doctype renderers
    if (LOG_PLUGIN_LOADING) log("Loading " + doctype_impl_sources.length + " doctype renderers:")
    for (var i = 0, doctype_impl_src; doctype_impl_src = doctype_impl_sources[i]; i++) {
        load_doctype_impl(doctype_impl_src)
    }
    // 3) load field renderers
    if (LOG_PLUGIN_LOADING) log("Loading " + field_renderer_sources.length + " data field renderers:")
    for (var i = 0, field_renderer_source; field_renderer_source = field_renderer_sources[i]; i++) {
        if (LOG_PLUGIN_LOADING) log("..... " + field_renderer_source)
        javascript_source(field_renderer_source)
    }
    // 4) load CSS stylesheets
    if (LOG_PLUGIN_LOADING) log("Loading " + css_stylesheets.length + " CSS stylesheets:")
    for (var i = 0, css_stylesheet; css_stylesheet = css_stylesheets[i]; i++) {
        if (LOG_PLUGIN_LOADING) log("..... " + css_stylesheet)
        $("head").append($("<link>").attr({rel: "stylesheet", href: css_stylesheet, type: "text/css"}))
    }
}

function load_plugin(plugin_source) {
    // load
    if (LOG_PLUGIN_LOADING) log("..... " + plugin_source)
    javascript_source(plugin_source)
    // instantiate
    var plugin_class = basename(plugin_source)
    if (LOG_PLUGIN_LOADING) log(".......... instantiating \"" + plugin_class + "\"")
    plugins[plugin_class] = new_object(plugin_class)
}

function load_doctype_impl(doctype_impl_src) {
    // load
    if (LOG_PLUGIN_LOADING) log("..... " + doctype_impl_src)
    javascript_source(doctype_impl_src)
    // instantiate
    var doctype_class = to_camel_case(basename(doctype_impl_src))
    if (LOG_PLUGIN_LOADING) log(".......... instantiating \"" + doctype_class + "\"")
    doctype_impls[doctype_class] = new_object(doctype_class)
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
    for (var plugin_class in plugins) {
        var plugin = get_plugin(plugin_class)
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
                alert("ERROR (trigger_hook): too much arguments (" +
                    (arguments.length - 1) + "), maximum is 3.\nhook=" + hook_name)
            }
            // 2) Store result
            // Note: undefined is not added to the result, but null is.
            if (res !== undefined) {
                result.push(res)
            }
        }
    }
    return result
}

function trigger_doctype_hook(doc, hook_name, args) {
    // Lookup doctype renderer
    var doctype_impl = get_doctype_impl(doc)
    // Trigger the hook only if it is defined (a doctype renderer must not define all hooks).
    if (doctype_impl[hook_name]) {
        return doctype_impl[hook_name](args)
    }
}

function get_plugin(plugin_class) {
    return plugins[plugin_class]
}

function get_doctype_impl(topic) {
    return doctype_impls[get_type(topic).js_renderer_class]
}

// --- DB ---

function document_exists(doc_id) {
    return dmc.get_topic(doc_id) != null
}

// --- GUI ---

function create_topic_from_menu() {
    var type_uri = ui.menu_item("create-type-menu").value
    // 1) update DB
    var topic = trigger_hook("custom_create_topic", type_uri)[0]
    if (!topic) {
        topic = create_topic(type_uri)
    }
    // 2) update GUI
    add_topic_to_canvas(topic, "edit")
}

// ---

function create_type_menu(menu_id, handler) {
    var type_menu = ui.menu(menu_id, handler)
    for (var type_uri in topic_types) {
        // add type to menu
        if (!contains(EXCLUDE_TYPES_FROM_MENUS, type_uri)) {
            type_menu.add_item({label: type_label(type_uri), value: type_uri, icon: get_icon_src(type_uri)})
        }
    }
    return type_menu
}

function rebuild_type_menu(menu_id) {
    var selection = ui.menu_item(menu_id).value
    $("#" + menu_id).replaceWith(create_type_menu(menu_id))
    ui.select_menu_item(menu_id, selection)
}

// ---

function searchmode_select() {
    return $("<select>").attr("id", "searchmode-select")
}

function create_special_select() {
    return $("<select>").attr("id", "special-select")
}

// - Commands -

function get_commands(context) {
    var menu_items = []
    //
    var item_lists = trigger_hook("add_commands", context)
    for (var i = 0, items; items = item_lists[i]; i++) {
        for (var j = 0, item; item = items[j]; j++) {
            menu_items.push(item)
        }
    }
    return menu_items
}

// - File upload -

/**
 * @param   command     the command (a string) send to the server along with the selected file.
 * @param   callback    the function that is invoked once the file has been uploaded and processed at server-side.
 *                      One argument is passed to that function: the object (deserialzed JSON) returned by the
 *                      (server-side) executeCommandHook.
 */
function show_upload_dialog(command, callback) {
    $("#upload-dialog-command").attr("value", command)
    $("#upload-dialog").dialog("open")
    // bind callback function, using artifact ID as event namespace
    $("#upload-target").unbind("load.deepamehta3-client")
    $("#upload-target").bind("load.deepamehta3-client", upload_complete(callback))

    function upload_complete(callback) {
        return function() {
            $("#upload-dialog").dialog("close")
            // Note: iframes (the upload target) must be DOM manipulated as frames
            var result = $("pre", window.frames["upload-target"].document).text()
            try {
                callback(JSON.parse(result))
            } catch (e) {
                alert("No valid server response: " + result + "\n(" + JSON.stringify(e) + ")")
            }
        }
    }
}

// ---

/**
 * @param   topics      Topics to render (array of Topic objects).
 */
function render_topic_list(topics) {
    var table = $("<table>")
    for (var i = 0, topic; topic = topics[i]; i++) {
        // icon
        var icon_td = $("<td>").addClass("topic-icon").addClass(i == topics.length - 1 ? "last-topic" : undefined)
        icon_td.append(render_topic_anchor(topic, type_icon_tag(topic.type_uri, "type-icon")))
        // label
        var topic_td = $("<td>").addClass("topic-label").addClass(i == topics.length - 1 ? "last-topic" : undefined)
        var list_item = $("<div>").append(render_topic_anchor(topic, topic.label))
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
function render_topic_anchor(topic, anchor_content) {
    return $("<a>").attr({href: "#"}).append(anchor_content).click(function() {
        reveal_topic(topic.id, true)
        return false
    })
}

//

/**
 * @return  The <img> element (jQuery object).
 */
function type_icon_tag(type_uri, css_class) {
    return image_tag(get_icon_src(type_uri), css_class)
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
function get_icon_src(type_uri) {
    // Note: topic_types[type_uri] is undefined if plugin is deactivated and content still exist.
    if (topic_types[type_uri] && topic_types[type_uri].icon_src) {
        return topic_types[type_uri].icon_src
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

function empty_detail_panel() {
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



// ******************
// *** Type Cache ***
// ******************



function add_topic_type(type_uri, topic_type) {
    topic_types[type_uri] = topic_type
    topic_type_icons[type_uri] = create_image(get_icon_src(type_uri))
}

function remove_topic_type(type_uri) {
    delete topic_types[type_uri]
}

function get_type(topic) {
    if (!topic.type_uri) {
        alert("ERROR (get_type):\n\nTopic has no type_uri attribute.\n\ntopic=" + JSON.stringify(topic))
    }
    //
    return topic_types[topic.type_uri]
}

/**
 * Looks up a type definition from the cache.
 *
 * @param   type_topic  the topic representing the type (object with "id", "type_uri", and "properties" attributes).
 *
 * @return  the type definition (object with "uri", "fields", "view", and "js_renderer_class" attributes)
 */
function get_topic_type(type_topic) {
    var type_uri = type_topic.properties["de/deepamehta/core/property/TypeURI"]
    var topic_type = topic_types[type_uri]
    //
    if (!topic_type) {
        throw "ERROR (get_topic_type): topic type not found in cache. Type URI: " + type_uri
    }
    //
    return topic_type
}

function get_data_field(topic_type, field_uri) {
    for (var i = 0, field; field = topic_type.fields[i]; i++) {
        if (field.uri == field_uri) {
            return field
        }
    }
}

function get_field_index(topic_type, field_uri) {
    for (var i = 0, field; field = topic_type.fields[i]; i++) {
        if (field.uri == field_uri) {
            return i
        }
    }
}

function add_field(type_uri, field) {
    topic_types[type_uri].fields.push(field)
}

function remove_field(type_uri, field_uri) {
    var topic_type = topic_types[type_uri]
    var i = get_field_index(topic_type, field_uri)
    // error check 1
    if (i == undefined) {
        alert("ERROR (remove_field): field with URI \"" + field_uri +
            "\" not found in fields " + JSON.stringify(topic_type.fields))
        return
    }
    //
    topic_type.fields.splice(i, 1)
    // error check 2
    if (get_field_index(topic_type, field_uri) >= 0) {
        alert("ERROR (remove_field): more than one field with URI \"" +
            field_uri + "\" found")
        return
    }
}

// FIXME: rename to set_data_field_order once type cache is encapsulated in its own class
function update_data_field_order(type_uri, field_uris) {
    var topic_type = topic_types[type_uri]
    //
    var reordered_fields = []
    for (var i = 0, field_uri; field_uri = field_uris[i]; i++) {
        reordered_fields.push(get_data_field(topic_type, field_uri))
    }
    //
    if (topic_type.fields.length != reordered_fields.length) {
        throw "ERROR (update_data_field_order): There are " + topic_type.fields.length + " data fields " +
            "to order but " + reordered_fields.length + " has been reordered"
    }
    //
    topic_type.fields = reordered_fields
}

function set_topic_type_uri(type_uri, new_type_uri) {
    var topic_type = topic_types[type_uri]      // lookup type
    remove_topic_type(type_uri)                 // remove it from cache
    topic_type.uri = new_type_uri               // set new URI
    add_topic_type(new_type_uri, topic_type)    // add to cache again
}

function set_topic_type_label(type_uri, label) {
    topic_types[type_uri].label = label
}

// ---

function get_value(topic, field_uri) {
    var value = topic.properties[field_uri]
    if (value == undefined) {
        // alert("WARNING (get_value): Data field \"" + field_uri + "\" has no value.\n\n" +
        //    "Topic: " + JSON.stringify(topic))
        value = ""
    }
    return value
}

// ---

/**
 * Returns the label for the topic.
 *
 * FIXME: method to be dropped? We have this logic at server-side
 */
function topic_label(topic) {
    var type = get_type(topic)
    // if there is a topic_label_field_uri declaration use the content of that field
    var field_uri = type.topic_label_field_uri
    if (field_uri) {
        return topic.properties[field_uri] || ""
    }
    // fallback: use the content of the first field
    return topic.properties[type.fields[0].uri] || ""
}

function type_label(type_uri) {
    return topic_types[type_uri].label
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
    var attr_keys = []
    var func_keys = []
    // sort keys
    for (var key in object) {
        if (typeof object[key] == "function") {
            func_keys.push(key)
        } else {
            attr_keys.push(key)
        }
    }
    attr_keys.sort()
    func_keys.sort()
    // build result
    var str = "\n"
    for (var i = 0, key; key = attr_keys[i]; i++) {
        str += key + ": " + object[key] + "\n"
    }
    for (var i = 0, key; key = func_keys[i]; i++) {
        str += "function " + key + "()\n"
    }
    return str
}

/**
 * Returns true if the array contains the object.
 */
function contains(array, object) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] == object) {
            return true
        }
    }
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
        alert("ERROR (clone): " + JSON.stringify(e))
    }
}

/**
 * Copies all attributes from source object to destination object.
 */
function copy(src_obj, dst_obj) {
    for (var key in src_obj) {
        dst_obj[key] = src_obj[key]
    }
}

/**
 * Constructs a new object dynamically.
 *
 * @param   class_name  Name of class.
 * @param   <varargs>   Variable number of arguments. Passed to the constructor.
 */
function new_object(class_name) {
    if (arguments.length == 1) {
        return new Function("return new " + class_name)()
    } else if (arguments.length == 2) {
        return new Function("arg1", "return new " + class_name + "(arg1)")(arguments[1])
    } else if (arguments.length == 3) {
        return new Function("arg1", "arg2", "return new " + class_name + "(arg1, arg2)")(arguments[1], arguments[2])
    } else if (arguments.length == 4) {
        return new Function("arg1", "arg2", "arg3", "return new " + class_name + "(arg1, arg2, arg3)")
                                                                        (arguments[1], arguments[2], arguments[3])
    } else {
        alert("ERROR (new_object): too much arguments (" +
            (arguments.length - 1) + "), maximum is 3.\nclass_name=" + class_name)
    }
}

function log(text) {
    if (ENABLE_LOGGING) {
        // Note: the log window might be closed meanwhile,
        // or it might not apened at all due to browser security restrictions.
        if (log_window && log_window.document) {
            log_window.document.writeln(render_text(text) + "<br>")
        }
    }
}

// === Text Utilities ===

function render_text(text) {
    return text.replace ? text.replace(/\n/g, "<br>") : text
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

function format_timestamp(timestamp) {
    return new Date(timestamp).toLocaleString()
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

// FIXME: not in use.
function Topic(id, type_uri, label, properties) {
    this.id = id
    this.type_uri = type_uri
    this.label = label
    this.properties = properties
}

// FIXME: not in use.
function Relation(id, type_id, src_topic_id, dst_topic_id, properties) {
    this.id = id
    this.type_id = type_id
    this.src_topic_id = src_topic_id
    this.dst_topic_id = dst_topic_id
    this.properties = properties
}

// === Image Tracker ===

var image_tracker

function create_image_tracker(callback_func) {

    return image_tracker = new ImageTracker()

    function ImageTracker() {

        var types = []      // topic types whose images are tracked

        this.add_type = function(type) {
            if (!contains(types, type)) {
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
