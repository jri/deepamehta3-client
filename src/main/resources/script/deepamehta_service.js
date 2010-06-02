function DeepaMehtaService(service_uri) {

    // --- Topics ---

    this.get_topic = function(topic_id) {
        return request("GET", "/topic/" + topic_id)
    }

    this.get_related_topics = function(topic_id, exclude_rel_types) {
        var query_string = ""
        if (exclude_rel_types) {
            query_string = "?" + param_list(exclude_rel_types, "exclude")
        }
        return request("GET", "/topic/" + topic_id + "/related_topics" + query_string)
    }

    // FIXME: this service call should be provided by the dm3_fulltext plugin
    this.fulltext_search = function(index, text) {
        var query_string = "?search=" + text
        return request("GET", "/topic" + query_string)
    }

    this.create_topic = function(topic) {
        var response = request("POST", "/topic", topic)
        return response.topic_id
    }

    this.set_topic_properties = function(topic) {
        request("PUT", "/topic/" + topic.id, topic.properties)
    }

    this.delete_topic = function(id) {
        request("DELETE", "/topic/" + id)
    }

    // --- Relations ---

    this.get_relation = function(topic1_id, topic2_id) {
        var query_string = "?src=" + topic1_id + "&dst=" + topic2_id
        return request("GET", "/relation" + query_string)
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

    function param_list(value_array, param_name) {
        for (var i = 0; i < value_array.length; i++) {
            value_array[i] = param_name + "=" + value_array[i]
        }
        return value_array.join("&")
    }

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
            throw "AJAX request failed: " + responseCode + " " + responseMessage + " (exception: " + exception + ")"
        }
    }
}
