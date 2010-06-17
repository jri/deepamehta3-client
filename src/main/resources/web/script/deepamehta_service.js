function DeepaMehtaService(service_uri) {

    // --- Topics ---

    this.get_topic = function(topic_id) {
        return request("GET", "/topic/" + topic_id)
    }

    this.get_topics = function(type_id) {
        return request("GET", "/topic/by_type/" + type_id)
    }

    /**
     * @param   include_topic_types     Optional: topic type filter (array of topic type names).
     * @param   exclude_rel_types       Optional: relation type filter (array of relation type names).
     */
    this.get_related_topics = function(topic_id, include_topic_types, exclude_rel_types) {
        var params = new RequestParameter()
        params.add_list("include_topic_types", include_topic_types)
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

    this.set_topic_properties = function(topic) {
        request("PUT", "/topic/" + topic.id, topic.properties)
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
        var response = request("POST", "/relation", relation)
        return response.relation_id
    }

    this.delete_relation = function(id) {
        request("DELETE", "/relation/" + id)
    }

    // --- Types ---

    this.get_topic_type_ids = function() {
        return request("GET", "/topictype")
    }

    this.get_topic_type = function(type_id) {
        return request("GET", "/topictype/" + type_id)
    }

    // --- Plugins ---

    this.get_plugins = function() {
        return request("GET", "/plugin")
    }

    // --- Private Helpers ---

    function request(method, uri, data) {
        var status              // "success" if request was successful
        var responseCode        // HTTP response code, e.g. 304
        var responseMessage     // HTTP response message, e.g. "Not Modified"
        var responseData        // in case of successful request: the response data (response body)
        var exception           // in case of unsuccessful request: possibly an exception
        //
        if (LOG_AJAX_REQUESTS) log(method + " " + uri + "\n..... " + JSON.stringify(data))
        //
        $.ajax({
            type: method,
            url: service_uri + uri,
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
