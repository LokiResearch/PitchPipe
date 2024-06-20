class FilterConfiguration {
    constructor(name, filterClass, color, size, kbdletter) {

        this.name = name;
        this.color = color;
        this.filterClass = filterClass;
        this.size = size;

        this.filterX = new filterClass();
        this.filterY = new filterClass();
        this.timer = undefined;

        this.ref('currentX', 0);
        this.ref('currentY', 0);
        
        this.position = { x: 0, y: 0 };

        this.$configurator = $('<div id="' + name + '" />');

        this.ref('enabled', false);
        
        var kbdchar = kbdletter.charCodeAt(0);
        $(window).keypress((e) => {
            if (e.which == kbdchar) {
                this.enabled = !this.enabled;
                $('#check' + this.name + 'filter').prop('checked', this.enabled);
            }
        });

        // Make the configurator's title
        var $conftitle = $('<h2/>');
        $('<span>&nbsp;</span>').css('background-color', color).appendTo($conftitle);
        var $checkbox = $('<input id="check' + this.name + 'filter" type="checkbox" />');
        $checkbox.appendTo($conftitle);
        $('<label for="check' + this.name + 'filter" />').text(this.filterClass.description + ' (' + kbdletter + ')').appendTo($conftitle);
        $checkbox.change(() => this.enabled = !this.enabled);

        $conftitle.appendTo(this.$configurator);

        this.configuration = {};

        const makeUpdateFn = (n) => {
            return (v) => {
                this.configuration[n] = v;
                this.configurationChanged();
            };
        }

        this.paramsInput = [];

        for (var p in this.filterClass.parameters) {
            var param = this.filterClass.parameters[p];
            var defvalue = undefined;
            if (typeof param['def'] != typeof undefined) {
                defvalue = param.def;
            }
            // Create a ref for this parameter that will notify any change.
            this.configuration[param.name] = defvalue;

            // Create the configurator part for this parameter, if it's a number
            if (typeof param['values'] === typeof undefined && param['optional'] != true) {
                var paramid = 'filter-' + this.name + '-param-' + param.name;
                var $param = $('<li id="' + paramid + '" />');
                //var $value = $('<span/>').addClass('tanglify_value');
                var $value = $('<input type="number" class="tanglify_value"/>,<input type="range" class="tanglify_value"/>');
                var $tanglified = $('<span/>').text(param.description + ': ').append($value).append('<input type="button" value="reset" class="tanglify_reset" />');

                var tangloptions = {
                    updateFn: makeUpdateFn(param.name)
                };
                if (typeof param['def'] != typeof undefined) {
                    tangloptions.defaultValue = param['def'];
                }
                if (typeof param['min'] != typeof undefined && typeof param['max'] != typeof undefined) {
                    tangloptions.min = param['min'];
                    tangloptions.max = param['max'];
                    tangloptions.step = 1;
                    var width = tangloptions.max - tangloptions.min;
                    if (width <= 1) {
                        tangloptions.step = 0.01;
                    }
                }
                if (typeof param['step'] != typeof undefined) {
                    tangloptions.step = param['step'];
                }
                $tanglified.tanglify(tangloptions);
                this.$configurator.append($param.append($tanglified));
            }

            this.paramsInput.push($value);
        }

        this.configurationChanged();

        return this;
    }
    configurationChanged() {

        var parameters = [];
        for (var p in this.filterClass.parameters) {
            var param = this.filterClass.parameters[p];
            parameters.push(this.configuration[param.name]);
        }

        this.filterX.updateParameters(...parameters);
        this.filterY.updateParameters(...parameters);
    }
    update(x, y) {
        if (this.filterX) {
            this.position.x = this.filterX.filter(x, new Date().getTime() * 0.001);
            this.currentX = this.position.x;
        }
        if (this.filterY) {
            this.position.y = this.filterY.filter(y, new Date().getTime() * 0.001);
            this.currentY = this.position.y;
        }
    }

    toggle(state){
        this.enabled = state;
        $('#check' + this.name + 'filter').prop('checked', this.enabled);
    }

    tune (maxTargetPrecision,
        maxLag_s,
        noiseVariance,
        maxAmplitude,
        sampleRate_hz,
        handleRinging = false) {

            // same new values for both filters

            const newValues = this.filterX.tune(maxTargetPrecision, maxLag_s, noiseVariance, maxAmplitude, sampleRate_hz, handleRinging);
            this.filterY.tune(maxTargetPrecision, maxLag_s, noiseVariance, maxAmplitude, sampleRate_hz, handleRinging);

            let i = 0;

            for (let p in this.filterClass.parameters) {
                const param = this.filterClass.parameters[p];
                const value = newValues[param.name];

                this.configuration[param.name] = value;

                const inputs = this.paramsInput[i ++];
                inputs[0].value = inputs[2].value = value; 
            }

            this.configurationChanged()
        }
}
