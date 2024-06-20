$(() => {

    const playground = $('#playground')[0];
    const ctx = playground.getContext("2d");

    const targetSize = 15;
    const target = new Target(playground.width, playground.height, "red", targetSize);

    let calibrator;

    class FilterDemo {
        constructor() {
            this.$playground = $('#playground');
            this.$configurator = $('#configurator');

            this.ref('x', 0);
            this.ref('y', 0);
            this.ref('noisyX', 0);
            this.ref('noisyY', 0);

            // State variables
            this.ref('SNR', 50);
            this.SNR$subscribe(this.updateNoiseFunction.bind(this));
            this.ref('stopped', false);
            this.stopped$subscribe(this.updateTimer.bind(this));
            this.ref('frequency', 25);
            this.frequency$subscribe(this.updateTimer.bind(this));

            // Setup the SNR setting in the configurator
            const $SNRsetting = $('<span>SNR (dB): </span>').append('<input type="number" class="tanglify_value"/>,<input type="range" class="tanglify_value"/>').append('<input type="button" value="reset" class="tanglify_reset" />').tanglify({
                updateFn:  (x) => {
                    this.SNR = x;
                }
            });

            // Setup de target size setting in the configurator
            const $targetSizeSetting = $('<span>size (px): </span>').append('<input type="number" class="tanglify_value"/>,<input type="range" class="tanglify_value"/>').append('<input type="button" value="reset" class="tanglify_reset" />').tanglify({
                updateFn:  (x) => {
                    target.size = x;
                },
                min : 1,
                max : 200,
                defaultValue: targetSize
            });

            //configurator dom
            this.$configurator
            .append($('<h1/>').text('Input'))
                .append($('<h2>Noisy signal</h2>')).append($('<ul/>').append($('<li/>').append($SNRsetting)))
                .append($('<h2>Target</h2>')).append($('<ul/>').append($('<li/>').append($targetSizeSetting)))
            .append($('<h1/>').text('Filters'));

            // Setup the OneEuroFilter
            const color = "#5252ff";
            const key = 's'
            this.filter = new FilterConfiguration("OneEuroFilter", EuroFilter, color, 3, key);
            this.$configurator.append(this.filter.$configurator);
            $('#OneEuroFilter').find('input').trigger('click');

            
            // Pitch Pipe button
            const nextStateLetter = "n"
            this.$configurator.append($('<h1/>').text(`PitchPipe`)).append($(`<button id="nextStateButton" onclick="window.calibrator.nextProcedure()">Press (${nextStateLetter}) for next State</button>`));
            const kbdchar = nextStateLetter.charCodeAt(0);
            $(window).keypress((e) => {
                if (e.which == kbdchar) {
                    $(nextStateButton).trigger("click");
                }
            });

            this.$configurator.append($('<h1/>').text('Calibration Instruction')).append($(EuroFilter.instructions));

            // Setup the noise function
            this.updateNoiseFunction();
            $(window).resize(this.updateNoiseFunction);

            // Setup the pointer input
            this.$playground.mousemove((e) => {
                if (!this.stopped) {
                    this.x = e.pageX - this.$playground.offset().left;
                    this.y = e.pageY - this.$playground.offset().top;
                }
            });

            // Run everything
            this.updateNoise()
            this.updateTimer();
        }
        updateNoiseFunction() {
            this.noiseFunction = makeNoiseWithSNR(this.SNR, Math.max($('#playground').width(), $('#playground').height()));
        }
        updateNoise() {
            this.noisyX = this.x + this.noiseFunction();
            this.noisyY = this.y + this.noiseFunction();
        }
        update() {

            ctx.clearRect(0, 0, this.$playground[0].width, this.$playground[0].height)
            this.filter.update(this.noisyX, this.noisyY);
            
            // draw target
            if(calibrator.enableTargets){
                ctx.beginPath();
                ctx.fillStyle = target.color;
                ctx.arc(target.x, target.y, target.size, 0, 2 * Math.PI);
                ctx.fill()
            }

            // draw pointer
            ctx.beginPath();
            if (this.filter.enabled){
                ctx.fillStyle = this.filter.color;
                ctx.arc(this.filter.position.x, this.filter.position.y, this.filter.size, 0, 2 * Math.PI)
            }else{
                ctx.fillStyle = "black";
                ctx.arc(this.noisyX, this.noisyY, this.filter.size, 0, 2 * Math.PI)
            }
            ctx.fill()

            // draw state

            const fontSize = 16;
            const i = calibrator.procedure.currentState.length * fontSize * 0.5;

            ctx.fillStyle = "black";
            ctx.fillRect(playground.width / 2 - i / 2, 8, i, (fontSize * 1.5));
            ctx.fillStyle = "white";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.font = fontSize.toString() + "px arial";
            ctx.fillText(calibrator.procedure.currentState, playground.width / 2, 20);

            calibrator.procedure.update(this.filter.position.x, this.filter.position.y);

        }
        updateTimer() {
            if (this.timer !== undefined) {
                clearInterval(this.timer);
                this.timer = undefined;
            }
            if (!this.stopped) {
                this.timer = setInterval(this.tick.bind(this), 1.0 / this.frequency * 1000);
            }
        }
        tick() {
            this.updateNoise();
            this.update();
        }
    }

    window.filterDemo = new FilterDemo();
    const oneEuroFilter = window.filterDemo.filter;

    const isInside = (x, y) => Math.sqrt((x-target.position.x)*(x-target.position.x)+(y-target.position.y)*(y-target.position.y)) <= target.size;

    $("#playground").on("click", (e) => {
        if (oneEuroFilter.enabled && isInside(oneEuroFilter.position.x, oneEuroFilter.position.y)){
            console.log("hit");
            target.newRandomPos(playground.width, playground.height)   
        }else if (isInside(window.filterDemo.noisyX, window.filterDemo.noisyY)){
            console.log("hit");
            target.newRandomPos(playground.width, playground.height)
        }else{
            console.log("miss");
        }

    });

    const leastPrecision = targetSize >> 2;
    const maxLag_s = 0.080

    calibrator = new Calibrator(
        leastPrecision,
        maxLag_s,
        window.filterDemo.filter);

    window.calibrator = calibrator;
});

