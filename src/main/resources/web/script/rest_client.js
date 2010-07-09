function DeepaMehtaClient(core_service_uri) {

    // --- Topics ---

    this.get_topic = function(topic_id) {
        return request("GET", "/topic/" + topic_id)
    }

    this.get_topics = function(type_uri) {
        return request("GET", "/topic/by_type/" + encodeURIComponent(type_uri))
    }

    /**
     * @param   include_topic_types     Optional: topic type filter (array of topic type names).
     * @param   exclude_rel_types       Optional: relation type filter (array of relation type names).
     */
    this.get_related_topics = function(topic_id, include_topic_types, include_rel_types, exclude_rel_types) {
        var params = new RequestParameter()
        params.add_list("include_topic_types", include_topic_types)
        params.add_list("include_rel_types", include_rel_types)
        params.add_list("exclude_rel_types", exclude_rel_types)
        return request("GET", "/topic/" + topic_id + "/related_topics" + params.to_query_string())
    }

    // FIXME: index parameter not used
    this.search_topics = function(index, text, field_id, whole_word) {
        var params = new RequestParameter({search: text, field: field_id, wholeword: whole_word})
        return request("GET", "/topic" + params.to_query_string())
    }

    this.create_topic = function(topic) {
        return request("POST", "/topic", topic)
    }

    this.set_topic_properties = function(topic_id, properties) {
        request("PUT", "/topic/" + topic_id, properties)
    }

    this.delete_topic = function(id) {
        request("DELETE", "/topic/" + id)
    }

    // --- Relations ---

    /**
     * Returns the relation between the two topics.
     * If no such relation exists nothing is returned (undefined). FIXME: check this.
     * If more than one relation matches, only the first one is returned.
     *
     * @return  The relation (a Relation object). FIXME: check this.
     */
    this.get_relation = function(src_topic_id, dst_topic_id) {
        var params = new RequestParameter({src: src_topic_id, dst: dst_topic_id})
        return request("GET", "/relation" + params.to_query_string())
    }

    this.create_relation = function(relation) {
        return request("POST", "/relation", relation)
    }

    this.set_relation_properties = function(relation_id, properties) {
        request("PUT", "/relation/" + relation_id, properties)
    }

    this.delete_relation = function(id) {
        request("DELETE", "/relation/" + id)
    }

    // --- Types ---

    this.get_topic_type_uris = function() {
        return request("GET", "/topictype")
    }

    this.get_topic_type = function(type_uri) {
        return request("GET", "/topictype/" + encodeURIComponent(type_uri))
    }

    this.create_topic_type = function(topic_type) {
        return request("POST", "/topictype", topic_type)
    }

    this.add_data_field = function(type_uri, field) {
        return request("POST", "/topictype/" + encodeURIComponent(type_uri), field)
    }

    this.update_data_field = function(type_uri, field) {
        return request("PUT", "/topictype/" + encodeURIComponent(type_uri), field)
    }

    this.set_data_field_order = function(type_uri, field_uris) {
        return request("PUT", "/topictype/" + encodeURIComponent(type_uri) + "/field_order", field_uris)
    }

    this.remove_data_field = function(type_uri, field_uri) {
        return request("DELETE", "/topictype/" + encodeURIComponent(type_uri) +
            "/field/" + encodeURIComponent(field_uri))
    }

    // --- Plugins ---

    this.get_plugins = function() {
        return request("GET", "/plugin")
    }

    /**
     * Sends an AJAX request. The URI is interpreted as an absolute URI.
     *
     * This utility method is called by plugins who register additional REST resources at an individual
     * namespace (server-side) and add corresponding service calls to the REST client instance.
     * For example, see the DeepaMehta 3 Topicmaps plugin.
     */
    this.request = function(method, uri, data) {
        return request(method, uri, data, true)
    }

    // --- Private Helpers ---

    /**
     * Sends an AJAX request.
     *
     * @param   is_absolute_uri     If true, the URI is interpreted as relative to the DeepaMehta core service URI.
     *                              If false, the URI is interpreted as an absolute URI.
     */
    function request(method, uri, data, is_absolute_uri) {
        var status                  // "success" if request was successful
        var responseCode            // HTTP response code, e.g. 304
        var responseMessage         // HTTP response message, e.g. "Not Modified"
        var responseData            // in case of successful request: the response data (response body)
        var exception               // in case of unsuccessful request: possibly an exception
        //
        if (LOG_AJAX_REQUESTS) log(method + " " + uri + "\n..... " + JSON.stringify(data))
        //
        $.ajax({
            type: method,
            url: is_absolute_uri ? uri : core_service_uri + uri,
            contentType: "application/json",
            data: JSON.stringify(data),
            processData: false,
            async: false,
            success: function(data, textStatus, xhr) {
                if (LOG_AJAX_REQUESTS) log("..... " + xhr.status + " " + xhr.statusText +
                    "\n..... " + JSON.stringify(data))
                responseData = data
            },
            error: function(xhr, textStatus, ex) {
                if (LOG_AJAX_REQUESTS) log("..... " + xhr.status + " " + xhr.statusText +
                    "\n..... exception: " + JSON.stringify(exception))
                exception = ex
            },
            complete: function(xhr, textStatus) {
                status = textStatus
                responseCode = xhr.status
                responseMessage = xhr.statusText
            }
        })
        if (status == "success") {
            return responseData
        } else {
            throw "AJAX request failed (" + responseCode + "): " + responseMessage + " (exception: " + exception + ")"
        }
    }

    function RequestParameter(params) {
        
        var param_array = []

        if (params && !params.length) {
            for (var param_name in params) {
                if (params[param_name]) {
                    add(param_name, params[param_name])
                }
            }
        }

        this.add = function(param_name, value) {
            add(param_name, value)
        }

        this.add_list = function(param_name, value_list) {
            if (value_list) {
                for (var i = 0; i < value_list.length; i++) {
                    add(param_name, value_list[i])
                }
            }
        }

        this.to_query_string = function() {
            var query_string = param_array.join("&")
            if (query_string) {
                query_string = "?" + query_string
            }
            return query_string
        }

        function add(param_name, value) {
            param_array.push(param_name + "=" + value)
        }
    }
}
