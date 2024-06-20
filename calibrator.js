// MIT License

// Copyright (c) 2019

// Eugene M. Taranta II <etaranta@gmail.com>
// Seng Lee Koh <ksenglee@knights.ucf.edu>
// Brian M. Williamson <brian.m.williamson@knights.ucf.edu>
// Kevin P. Pfeil <kevin.pfeil@knights.ucf.edu>
// Corey R. Pittman <cpittman@knights.ucf.edu>
// Joseph J. LaViola Jr. <jjl@cs.ucf.edu>
// University of Central Florida

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE. 


const calibrationStates = {
    WAIT_TO_START: 'wait to start (next to continu)',
    START: 'start',
    ESTIMATE_SAMPLE_RATE: 'estimate sample rate (fps)',
    ESTIMATE_NOISE_PREPARE: 'estimate noise (next to continu)',
    ESTIMATE_NOISE: "estimate noise don't move",
    ESTIMATE_AMPLITUDE_PREPARE: 'estimate amplitude (next to continu)',
    ESTIMATE_AMPLITUDE: 'estimate amplitude click target',
    ESTIMATE_PARAMETERS: 'estimate parameters',
    ESTIMATE_TUNED: 'estimate tuned',
    COMPLETE: 'complete (next to restart)',
};

/**
 * This object is used to estimate the maximum
 * amplitude (speed) the user will move AND at
 * the same time, we estimate the sampling rate.
 */
class EstimateSampleRate {
    constructor() {
        var frameRateEstimator = new FrameRateEstimator();

        /**
         * Feed each sampling into this update function.
         */
        this.update = function () {
            frameRateEstimator.update();
        };

        /**
         * Get most recent sampling rate estimate.
         */
        this.sample_hz = function () {
            return Math.round(frameRateEstimator.fps());
        };
    }
};

/**
 * This object is used to estimate the maximum
 * amplitude (speed) the user will move AND at
 * the same time, we estimate the sampling rate.
 */
class EstimateAmplitude {
    constructor(noiseStddev) {
        var distanceEstimatorX = new MaximumDistanceEstimator();
        var distanceEstimatorY = new MaximumDistanceEstimator();
        var noiseStddev = noiseStddev;

        /**
         * Feed each sampling into this update function.
         */
        this.update = function (
            posX,
            posY) {
            distanceEstimatorX.update(posX, noiseStddev);
            distanceEstimatorY.update(posY, noiseStddev);
        };

        /**
         * Get most recent maximum amplitude estimate.
         */
        this.amplitude = function () {
            return Math.max(
                distanceEstimatorX.velocity(),
                distanceEstimatorY.velocity());
        };
    }
};

/**
 * Estimate noise in signal. The user ought be asked
 * to hold still during this time. Slow, idle motions
 * are okay, but rapid movements and jerks may inflate
 * the noise estimate.
 */
class EstimateNoise {
    constructor(sample_hz,
        threshold = 0.01) {
        var noiseEstimatorsX = [];
        var noiseEstimatorsY = [];
        var stats = new RunningStatistics();
        var threshold = threshold;

        // The Nyquist frequency is half the sampling rate.
        // We can monitor those frequencies that fall 
        // between 10Hz and the Nyquist, which still allows 
        // for some slow, low frequency, idling motion.
        sample_hz = Math.round(sample_hz);
        sample_hz = sample_hz + (sample_hz % 1);

        const frequency_cnt = sample_hz / 2.0 - 10.0;

        for (var ii = 0.0; ii < frequency_cnt; ii += 1) {
            noiseEstimatorsX.push(new NoiseEstimator(ii, sample_hz));
            noiseEstimatorsY.push(new NoiseEstimator(ii, sample_hz));
        }

        /**
         * Update estimate with new samples. Note, we assume
         * noise is homogeneous across X and Y.
         *
         * Returns true once the 95% CI width is
         * within a given threshold of the mean.
         */
        this.update = function (
            posX,
            posY) {
            var ii = 0;

            for (ii = 0; ii < noiseEstimatorsX.length; ii++) {
                noiseEstimatorsX[ii].update(posX);
                noiseEstimatorsY[ii].update(posY);

                const varX = noiseEstimatorsX[ii].variance();
                const varY = noiseEstimatorsY[ii].variance();

                if (varX == 0) {
                    continue;
                }

                stats.update(varX);
                stats.update(varY);
            }

            const ratio = (2.0 * stats.ci95) / stats.mean;
            return (ratio < threshold);
        };

        /**
         * Return white noise variance estimate,
         * which is the mean of our PSD estimates.
         */
        this.variance = function () {
            return stats.mean;
        };

        /**
         * For debug, display purposes.
         */
        this.countDown = function () {
            ratio = (2.0 * stats.ci95) / stats.mean;
            return ratio - threshold;
        };
    }
}

/**
 *
 */
class RunCalibrationProcedure {
    constructor(leastPrecision, worstLag_s, lowPassFilter) {

        this.leastPrecision = leastPrecision;
        this.worstLag_s = worstLag_s;
        this.lowPassFilter = lowPassFilter;

        this.#init()
    }

    #init() {

        this.lowPassFilter.toggle(false);

        this.currentState = calibrationStates.WAIT_TO_START;
        this.nextState = calibrationStates.START;

        this.sampleRateEstimator = null;
        this.noiseEstimator = null;
        this.amplitudeEstimator = null;
        this.startTime_ms = Date.now();
        this.lastUpdateTime_ms = 0.0;
        this.noiseStddev = null;

        this.amplitude = 0.0;
        this.sample_hz = 0.0;

        this.enableTargets = false;
    }

    estNoiseVariance() {
        return noiseEstimator.variance();
    }
 
    update(x, y) {

            const delta_ms = Date.now() - this.startTime_ms;

            // Give first instruction, then kick off.
            if (this.currentState == calibrationStates.START) {
                this.#init(); // reset when calibration start
                this.sampleRateEstimator = new EstimateSampleRate();
                this.currentState = calibrationStates.ESTIMATE_SAMPLE_RATE;
                this.nextState = calibrationStates.ESTIMATE_SAMPLE_RATE;
                this.startTime_ms = Date.now();
            }



            // First estimate the sample rate
            else if (this.currentState == calibrationStates.ESTIMATE_SAMPLE_RATE) {
                this.sampleRateEstimator.update();

                if (delta_ms > 2000.0) {
                    this.currentState = calibrationStates.ESTIMATE_NOISE_PREPARE;
                    this.nextState = calibrationStates.ESTIMATE_SAMPLE_RATE;
                    const sample_hz = this.sampleRateEstimator.sample_hz();
                    console.log('Sample rate: ' + sample_hz);
                    this.noiseEstimator = new EstimateNoise(sample_hz);
                    this.startTime_ms = Date.now();

                    this.sample_hz = sample_hz;
                }
            }



            // Wait until system is ready.
            else if (this.currentState == calibrationStates.ESTIMATE_NOISE_PREPARE) {
                this.startTime_ms = Date.now();

                this.nextState = calibrationStates.ESTIMATE_NOISE;
            }


            // Estimate noise in signal, after which we can tune 
            // the filter.
            else if (this.currentState == calibrationStates.ESTIMATE_NOISE) {
                // Give time for user to settle


                if (delta_ms < 1000.0) {
                    return this.currentState;
                }

                const complete = this.noiseEstimator.update(x, y);

                if (Date.now() - this.lastUpdateTime_ms > 250) {
                    this.lastUpdateTime_ms = Date.now();
                }

                if (complete == true) {
                    this.noiseStddev = Math.sqrt(this.noiseEstimator.variance());
                    this.currentState = calibrationStates.ESTIMATE_AMPLITUDE_PREPARE;
                    this.nextState = calibrationStates.ESTIMATE_AMPLITUDE_PREPARE;
                    this.amplitudeEstimator = new EstimateAmplitude(this.noiseStddev);

                    console.log("noise estimate", this.noiseStddev)
                }
            }



            // Wait for caller to advance state
            else if (this.currentState == calibrationStates.ESTIMATE_AMPLITUDE_PREPARE) {

                this.nextState = calibrationStates.ESTIMATE_AMPLITUDE;

                this.enableTargets = true;

                this.startTime_ms = Date.now();

            }

            // Determine maximum movement size over about three seconds,
            // then go to noise estimation state.
            else if (this.currentState == calibrationStates.ESTIMATE_AMPLITUDE) {
                this.amplitudeEstimator.update(
                    x,
                    y);
                    
                    
                    if (delta_ms > 10000.0){
                        this.currentState = calibrationStates.ESTIMATE_PARAMETERS;
                    }
            }



            // Finally, tune the filter!
            else if (this.currentState == calibrationStates.ESTIMATE_PARAMETERS) {
                this.lowPassFilter.tune(
                    this.leastPrecision / 3.0,
                    this.worstLag_s,
                    this.noiseStddev * this.noiseStddev,
                    this.amplitudeEstimator.amplitude(),
                    this.sampleRateEstimator.sample_hz());

                this.currentState = calibrationStates.COMPLETE;
                this.nextState = calibrationStates.START
                this.enableTargets = false;

                this.amplitude = this.amplitudeEstimator.amplitude();

                this.lowPassFilter.toggle(true);
            }

            return this.currentState;
    }
}

/**
 * Example calibration system.
 */
class Calibrator {
    constructor(leastPrecision,
        worstLag_s,
        lowPassFilter) {
        /**
         * Steps in calibration procedure.
         */

        this.states = calibrationStates;

        this.procedure = new RunCalibrationProcedure(leastPrecision, worstLag_s, lowPassFilter);
    }

    get enableTargets() {

        if(this.procedure.currentState == calibrationStates.WAIT_TO_START || this.procedure.currentState == calibrationStates.COMPLETE){
            return true;
        }

        return this.procedure.enableTargets;
    }

    nextProcedure() {
        this.procedure.currentState = this.procedure.nextState;
    }
}

// The smallest target in our Fitt's law test.
// var minimumTargetSize = 14.0;

// Results show approximately that if spatial jitter
// is less than a quarter of the target size, the impact
// on misses is negligible.
// var leastPrecision = Math.floor(minimumTargetSize * 0.25)

// Similarly, lag doesn't become much of a problem
// until it reaches above 80ms. 
// var maxLag_s = 0.080

// Note, precision is given priority over lag. In general,
// if we can meet the precision requirement and we are
// below max lag, then we can try to tighten precision.

//var calibrator = Calibrator(
//    leastPrecision,
//    maxLag_s,
//    new EmaFilter());

/**
var calibrator = Calibrator(
    1.0,
    maxLag_s,
    new EuroFilter(1, 1));
/**/





