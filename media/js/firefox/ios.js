/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// create namespace
if (typeof window.Mozilla === 'undefined') {
    window.Mozilla = {};
}

(function($, Mozilla) {
    'use strict';

    var params = new window._SearchParams();
    var $html = $('html');
    var $body = $('body');

    // does page locale have send to device?
    var hasWidget = $('#intro .get-fxios').hasClass('show-widget');

    // Sync instructions
    var $instructions = $('#sync-instructions');
    var $fill = $('<div id="modal" role="dialog" tabindex="-1"></div>');

    // initialize state - runs after geolocation has completed
    var initState = function() {
        var client = Mozilla.Client;
        var state = 'Unknown';
        var syncCapable = false;

        if (client.isFirefox) {
            // Firefox for Android
            if (client.isFirefoxAndroid) {
                swapState('state-fx-android');
                state = 'Firefox Android';

            // Firefox for iOS
            } else if (client.isFirefoxiOS) {
                swapState('state-fx-ios');
                state = 'Firefox iOS';

            // Firefox for Desktop
            } else {

                if (client.FirefoxMajorVersion >= 31) {

                    // Set syncCapable so we know not to send tracking info
                    // again later
                    syncCapable = true;

                    // Query if the UITour API is working before we use the API
                    Mozilla.UITour.getConfiguration('sync', function (config) {

                        // Variation #1: Firefox 31+ signed IN to Sync (default)
                        if (config.setup) {
                            swapState('state-fx-signed-in');
                            state = 'Firefox Desktop: Signed-In';

                        // Variation #2: Firefox 31+ signed OUT of Sync
                        } else {
                            swapState('state-fx-signed-out');
                            state = 'Firefox Desktop: Signed-Out';
                        }

                        // Call GA tracking here to ensure it waits for the
                        // getConfiguration async call
                        window.dataLayer.push({
                            'event': 'ios-page-interactions',
                            'interaction': 'page-load',
                            'loadState': state
                        });
                    });
                }

            }

        // Not Firefox
        } else {
            swapState('state-not-fx');
            state = 'Not Firefox';
        }

        // Send page state to GA if it hasn't already been sent
        if (syncCapable === false) {
            window.dataLayer.push({
                'event': 'ios-page-interactions',
                'interaction': 'page-load',
                'loadState': state
            });
        }
    };

    var swapState = function(stateClass) {
        $body.removeClass('state-default');
        $body.addClass(stateClass);
    };

    function initSendToDeviceForm() {
        // only initialize send to device if locale has the widget
        if (!hasWidget) {
            return;
        }

        var sendToDeviceForm = new Mozilla.SendToDevice();
        var sendToDeviceWidgetTop = $('#send-to-device').offset().top;

        // initialize send to device form
        sendToDeviceForm.init();

        // scroll to send to device form when header button is clicked
        $('.send-to').on('click', function(e) {
            e.preventDefault();

            Mozilla.smoothScroll({
                top: sendToDeviceWidgetTop - 100
            });
        });
    }

    // initialize page state
    initState();

    // initialize send to device form
    initSendToDeviceForm();

    // Firefox Sync sign in flow button
    $('.sync-button').on('click', function(e) {
        e.preventDefault();
        Mozilla.UITour.showFirefoxAccounts(params.utmParamsFxA());
    });

    // Show Sync instructions in a modal doorhanger
    $('.sync-start-ios').on('click', function(e) {
        e.preventDefault();
        $html.addClass('noscroll');
        $fill.append($instructions);
        $body.append($fill);
    });

    // dismiss sync instructions
    $('#sync-instructions .btn-dismiss').on('click', function(e) {
        e.preventDefault();
        $html.removeClass('noscroll');
        $body.append($instructions);
        $fill.remove();
    });
})(jQuery, Mozilla);
