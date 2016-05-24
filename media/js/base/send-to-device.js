/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* globals Spinner */

// create namespace
if (typeof Mozilla === 'undefined') {
    var Mozilla = {};
}

(function($) {
    'use strict';

    var SendToDevice = function() {

        this.formLoaded = false;
        this.formTimeout = null;
        this.smsEnabled = false;

        this.$widget = $('#send-to-device');
        this.$form = this.$widget.find('#send-to-device-form');
        this.$formFields = this.$form.find('.input');
        this.$input = this.$formFields.find('#id-input');
        this.$thankyou = this.$widget.find('.thank-you');
        this.$errorList = this.$form.find('.error-list');
        this.$spinnerTarget = this.$form.find('.loading-spinner');
        this.$footerLinks = this.$widget.find('footer > ul');
        this.$sendAnotherLink = this.$form.find('.send-another');
        this.$formHeading = this.$widget.find('.form-heading');
        this.spinnerColor = this.$widget.data('spinnerColor') || '#000';

        this.spinner = new Spinner({
            lines: 12, // The number of lines to draw
            length: 4, // The length of each line
            width: 2, // The line thickness
            radius: 4, // The radius of the inner circle
            corners: 0, // Corner roundness (0..1)
            rotate: 0, // The rotation offset
            direction: 1, // 1: clockwise, -1: counterclockwise
            color: this.spinnerColor, // #rgb or #rrggbb or array of colors
            speed: 1, // Rounds per second
            trail: 60, // Afterglow percentage
            shadow: false, // Whether to render a shadow
            hwaccel: true // Whether to use hardware acceleration
        });
    };

    // static value for user country code
    SendToDevice.COUNTRY_CODE = '';

    /**
     * Initialise the form messaging and bind events.
     */
    SendToDevice.prototype.init = function() {
        if (this.$widget.length === 1) {
            this.checkLocation();
            this.bindEvents();
        }
    };

    /**
     * Checks to see if the visitor is located in the US
     * using MLS https://location.services.mozilla.com/api
     */
    SendToDevice.prototype.checkLocation = function() {
        var self = this;
        var key = this.$widget.data('key');

        // should location.services.mozilla.com be slow to load,
        // just show the email messaging after 5 seconds waiting.
        this.formTimeout = setTimeout(self.updateMessaging, 5000);

        $.get('https://location.services.mozilla.com/v1/country?key=' + key)
            .done(function(data) {
                if (data && data.country_code) {
                    SendToDevice.COUNTRY_CODE = data.country_code.toLowerCase();
                }
                self.updateMessaging();
            })
            .fail(function() {
                // something went wrong, show only the email messaging.
                self.updateMessaging();
            });
    };

    /**
     * Checks to update the form messaging based on the users location
     */
    SendToDevice.prototype.updateMessaging = function() {
        clearTimeout(this.formTimeout);
        if (!this.formLoaded) {
            this.formLoaded = true;

            // if the page visitor is in the US, show the SMS messaging / copy
            // can also append '?geo=us' query param for easier testing/debugging
            if (SendToDevice.COUNTRY_CODE === 'us' || window.location.href.indexOf('?geo=us') !== -1) {
                this.showSMS();
            }
        }
    };

    /**
     * Updates the form fields to include SMS messaging
     */
    SendToDevice.prototype.showSMS = function() {
        var $label = this.$formFields.find('#form-input-label');
        this.$form.addClass('us');
        $label.html($label.data('alt'));
        this.$input.attr('placeholder', this.$input.data('alt'));
        this.smsEnabled = true;
    };

    /**
     * Binds form submission and click events
     */
    SendToDevice.prototype.bindEvents = function() {
        this.$form.on('submit', $.proxy(this.onFormSubmit, this));
        this.$footerLinks.on('click', 'a', this.trackFooterLinks);
        this.$sendAnotherLink.on('click', $.proxy(this.sendAnother, this));
    };

    /**
     * Remove all form event handlers
     */
    SendToDevice.prototype.unbindEvents = function() {
        this.$form.off('submit');
        this.$footerLinks.off('click');
        this.$sendAnotherLink.off('click');
    };

    /**
     * Show the form again to send another link
     */
    SendToDevice.prototype.sendAnother = function(e) {
        e.preventDefault();
        this.$input.val('');
        this.$errorList.addClass('hidden');
        this.$thankyou.addClass('hidden');
        this.$formHeading.removeClass('hidden');
        this.$formFields.removeClass('hidden');
        this.$input.focus();
    };

    /**
     * Enable form fields and hide loading indicator
     */
    SendToDevice.prototype.enableForm = function() {
        this.$input.prop('disabled', false);
        this.$form.removeClass('loading');
        this.$spinnerTarget.hide();
    };

    /**
     * Disable form fields and show loading indicator
     */
    SendToDevice.prototype.disableForm = function() {
        this.$input.prop('disabled', true);
        this.$form.addClass('loading');
        this.spinner.spin(this.$spinnerTarget.show()[0]);
    };

    /**
     * Reallly primative validation (e.g a@a)
     * matches built-in validation in Firefox
     * @param {email}
     */
    SendToDevice.prototype.checkEmailValidity = function(email) {
        return /\S+@\S+/.test(email);
    };

    /**
     * Handle form submission via XHR
     */
    SendToDevice.prototype.onFormSubmit = function(e) {
        e.preventDefault();

        var self = this;
        var action = this.$form.attr('action');
        var formData = this.$form.serialize();

        this.disableForm();

        // if we know the user has not been prompted to enter an SMS number,
        // perform some basic email validation before submitting the form.
        if (!this.smsEnabled && !this.checkEmailValidity(this.$input.val())) {
            this.onFormError(['email']);
            return;
        }

        // else POST and let the server work out whether the input is a
        // valid email address or US phone number.
        $.post(action, formData)
            .done(function(data) {
                if (data.success) {
                    self.onFormSuccess(data.success);
                } else if (data.errors) {
                    self.onFormError(data.errors);
                }
            })
            .fail(function(error) {
                self.onFormFailure(error);
            });
    };

    SendToDevice.prototype.onFormSuccess = function() {
        this.$errorList.addClass('hidden');
        this.$formFields.addClass('hidden');
        this.$formHeading.addClass('hidden');
        this.$thankyou.removeClass('hidden');
        this.enableForm();

        // track signup type in GA
        var isEmail = this.checkEmailValidity(this.$input.val());

        window.dataLayer.push({
            'event': 'send-to-device-success',
            'input': isEmail ? 'email-address' : 'phone-number'
        });
    };

    SendToDevice.prototype.onFormError = function(errors) {
        var errorClass;
        this.$errorList.find('li').hide();
        this.$errorList.removeClass('hidden');

        if ($.inArray('platform', errors) !== -1) {
            errorClass = '.platform';
        } else if (this.smsEnabled && $.inArray('number', errors) !== -1) {
            errorClass = '.sms';
        } else {
            errorClass = '.email';
        }

        this.$errorList.find(errorClass).show();
        this.enableForm();
    };

    SendToDevice.prototype.onFormFailure = function() {
        this.$errorList.find('li').hide();
        this.$errorList.removeClass('hidden');
        this.$errorList.find('.system').show();
        this.enableForm();
    };

    window.Mozilla.SendToDevice = SendToDevice;

})(window.jQuery);
