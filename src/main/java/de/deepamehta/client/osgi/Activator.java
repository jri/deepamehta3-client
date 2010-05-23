package de.deepamehta.client.osgi;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleActivator;
import org.osgi.framework.BundleContext;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.ServiceReference;
import org.osgi.service.http.HttpContext;
import org.osgi.service.http.HttpService;
import org.osgi.service.http.NamespaceException;
import org.osgi.util.tracker.ServiceTracker;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;



public class Activator implements BundleActivator {

    private ServiceTracker httpServiceTracker;

    private HttpService httpService = null;

    private Logger logger = Logger.getLogger(getClass().getName());



    // **************************************
    // *** BundleActivator Implementation ***
    // **************************************



    public void start(BundleContext context) {
        logger.info("Starting DeepaMehta Client bundle");
        //
        httpServiceTracker = createHttpServiceTracker(context);
        httpServiceTracker.open();
    }

    public void stop(BundleContext context) {
        logger.info("Stopping DeepaMehta Client bundle");
        //
        httpServiceTracker.close();
    }



    // ***********************
    // *** Private Helpers ***
    // ***********************



    private ServiceTracker createHttpServiceTracker(BundleContext context) {
        return new ServiceTracker(context, HttpService.class.getName(), null) {

            @Override
            public Object addingService(ServiceReference serviceRef) {
                logger.info("HTTP service becomes available");
                httpService = (HttpService) super.addingService(serviceRef);
                registerServlet();
                return httpService;
            }

            @Override
            public void removedService(ServiceReference ref, Object service) {
                if (service == httpService) {
                    logger.info("HTTP service goes away");
                    unregisterServlet();
                    httpService = null;
                }
                super.removedService(ref, service);
            }
        };
    }

    // ---

    private void registerServlet() {
        try {
            logger.info("Registering client resources");
            httpService.registerResources("/", "/site", null);
        } catch (Throwable ie) {
            throw new RuntimeException(ie);
        }
    }

    private void unregisterServlet() {
        if (httpService != null) {
            logger.info("Unregistering client resources");
            httpService.unregister("/");
        }
    }
}
