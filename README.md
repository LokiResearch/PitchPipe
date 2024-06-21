# Forked version of Pitch Pipe
This forked version of pitch provides an interface to the code provided in the original repo.
The live version is available at https://lokiresearch.github.io/PitchPipe/

# Pitch Pipe
Pitch Pipe is a custom low-pass filter calibration technique that finds optimal parameters based on context specific information. As such, Pitch Pipe requires three inputs: a signal from which to derive relevant characteristics, a low-pass filter to calibrate, and an application specific criteria to optimize for, namely precision and lag. From the input device signal, Pitch Pipe extracts noise and maximum user speed estimates, which we use to generate synthetic noise and edge patterns. Thereafter, Pitch Pipe performs a grid search over the filter’s parameter space, evaluating its performance on the stated synthetic data. Pitch Pipe finally outputs the parameter set that best matches the application specific criteria. As such, Pitch Pipe internally comprises three steps that are to estimate noise, estimate maximum user speed, and optimize the parameter set.

## How To Cite
When using Pitch Pipe, please reference the following paper: [Coming Soon...]
