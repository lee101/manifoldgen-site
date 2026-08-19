PYTHON ?= .venv/bin/python
OMNISERVE_NATIVE ?= ../../omniserve-native
JOBCTL := $(OMNISERVE_NATIVE)/build/omni-job
SOURCE := downloads/astronaut-flower-field.webm

.PHONY: all scheduler test submit run benchmark clean

all: scheduler

scheduler:
	$(MAKE) -C $(OMNISERVE_NATIVE) build/omni-job

test: all
	$(MAKE) -C $(OMNISERVE_NATIVE) test
	$(PYTHON) -m unittest discover -s tests -v

submit: all
	$(PYTHON) matting.py submit --input $(SOURCE)

run: all
	$(PYTHON) matting.py run --input $(SOURCE)

benchmark:
	$(PYTHON) matting.py benchmark --input $(SOURCE) --ratios 0.25,0.375,0.5,0.75,1.0

clean:
	rm -rf build __pycache__ tests/__pycache__
