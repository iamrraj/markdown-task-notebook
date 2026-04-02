.PHONY: start push publish pack

start:
	node server.js

push:
	git push origin main

publish:
	npm publish

pack:
	npm pack --dry-run
