#!/usr/bin/awk -f

# generate rules to build all dockerfiles in the repository

# use the Dockerfile path to generate a make target
function genTarget(dockerfile)
{
	# obtain the Dockerfile path prefix and suffix
	split(dockerfile, path, /\/Dockerfile/);
	# use the path prefix to build the normalised target name
	target = path[1]
	gsub(/\//, "-", target);
	# replace the path prefix with the build prefix in two stages in case there
	# is no build prefix - e.g. cli pod
	# in the case of "local-dev", just replace the "dev" part to match naming
	# used by the existing build system
	sub(/images-|services-|dev-/, "", target);
	sub(/^/, "build\:", target);
	# the Dockerfile may have a hyphenated suffix, so append it to the target
	# e.g. -galera
	return target path[2]
}

# generate a normalised dependency name from an image name
function genDependency(image) {
	# return immediately if image is empty
	if (image == "") { return image }
	# strip unused suffixes
	sub(/:\${LAGOON_GIT_BRANCH:-latest} as yarn-workspace-builder/, "", image);
	sub(/ as .+/, "", image);
	# replace colons with hyphens in the path
	gsub(/:/, "-", image);
	# add the build prefix
	sub(/^/, " build\:", image);
	return image
}

# append the rule's target to the list of all targets
function appendToAllTargets(rule) {
	sub(/:( .*|$)/, "", rule)
	allTargets = allTargets " " rule
}

# given a full target (target name and dependencies), and a dockerfile path,
# generate rule(s) for building an image or set of versioned images
function genBuildRules(fullTarget, dockerfile) {
	# the rules variable stores the full make targets and recipes
	rules = ""
	# get the context path
	context = dockerfile
	sub(/\/Dockerfile.*/, "", context);
	# remove version placeholder
	gsub(/-\${.+_VERSION}/, "", fullTarget);
	# extract the image name
	name = fullTarget;
	sub(/^build\\:/, "", name);
	sub(/:.*/, "", name);
	allNames = allNames " " name
	if (fullTarget ~ /^build\\:php/) {
		# extract the image type
		type = fullTarget;
		sub(/^build\\:php/, "", type);
		sub(/:.+/, "", type);
		# create array of versions
		split(PHP_VERSIONS, versions, " ");
		# construct the rules
		for (i in versions) {
			# insert the version
			rule = fullTarget;
			gsub(/php/, "php-" versions[i], rule);
			# append versioned target and tag to the lists of all targets and tags
			appendToAllTargets(rule)
			allTags = allTags " php:" versions[i] type
			# append the recipe to the rules
			rules = rules rule "\n\t$(call docker_build_version_cmd,php," \
						versions[i] "," versions[i] type "," dockerfile "," context ")\n";
		}
	} else if (fullTarget ~ /^build\\:node/) {
		# extract the image type
		type = fullTarget;
		sub(/^build\\:node/, "", type);
		sub(/:.+/, "", type);
		# create array of versions
		split(NODE_VERSIONS, versions, " ");
		# construct the rules
		for (i in versions) {
			# insert the version
			rule = fullTarget;
			gsub(/node/, "node-" versions[i], rule);
			# append versioned target and tag to the lists of all targets and tags
			appendToAllTargets(rule)
			allTags = allTags " node:" versions[i] type
			# append the recipe to the rules
			rules = rules rule "\n\t$(call docker_build_version_cmd,node," \
						versions[i] "," versions[i] type "," dockerfile "," context")\n";
		}
	} else if (fullTarget ~ /^build\\:python/) {
		# extract the image type
		type = fullTarget;
		sub(/^build\\:python/, "", type);
		sub(/:.+/, "", type);
		# create array of versions
		split(PYTHON_VERSIONS, versions, " ");
		# construct the rules
		for (i in versions) {
			# insert the version
			rule = fullTarget;
			gsub(/python/, "python-" versions[i], rule);
			# append versioned target and tag to the lists of all targets and tags
			appendToAllTargets(rule)
			allTags = allTags " python:" versions[i] type
			# append the recipe to the rules
			rules = rules rule "\n\t$(call docker_build_version_cmd,python," \
						versions[i] "," versions[i] type "," dockerfile "," context")\n";
		}
	} else if (fullTarget ~ /^build\\:solr/) {
		# extract the image type
		type = fullTarget;
		sub(/^build\\:solr/, "", type);
		sub(/:.+/, "", type);
		# create array of versions
		split(SOLR_VERSIONS, versions, " ");
		# construct the rules
		for (i in versions) {
			# insert the version
			rule = fullTarget;
			gsub(/solr/, "solr-" versions[i], rule);
			# append versioned target and tag to the lists of all targets and tags
			appendToAllTargets(rule)
			allTags = allTags " solr:" versions[i] type
			# append the recipe to the rules
			rules = rules rule "\n\t$(call docker_build_version_cmd,solr," \
						versions[i] "," versions[i] type "," dockerfile "," context")\n";
		}
	} else if (fullTarget ~ /^build\\:(elasticsearch|kibana|logstash)/) {
		# create array of versions
		split(ELASTIC_VERSIONS, versions, " ");
		# construct the rules
		for (i in versions) {
			# generate the minor version by stripping the patch version
			minorVer = sprintf("%.3s", versions[i])
			# insert the version
			rule = fullTarget;
			gsub(/kibana/, "kibana-" minorVer, rule);
			gsub(/elasticsearch/, "elasticsearch-" minorVer, rule);
			gsub(/logstash/, "logstash-" minorVer, rule);
			# append the recipe to the rules
			rules = rules rule "\n\t$(call docker_build_version_cmd," name "," \
						versions[i] "," minorVer "," dockerfile "," context")\n";
			# append versioned target and tag to the lists of all targets and tags
			appendToAllTargets(rule)
			allTags = allTags " " name ":" minorVer
		}
	} else if (fullTarget ~ /^build\\:(ssh|yarn-workspace-builder|drush-alias-testing)/) {
		# these images use lagoon repo root context
		rules = fullTarget \
					"\n\t$(call docker_build_cmd," name "," dockerfile ",.)\n";
		# append versioned target and tag to the lists of all targets and tags
		appendToAllTargets(fullTarget)
		allTags = allTags " " name
	} else {
		# append the recipe to the rules
		rules = fullTarget \
					"\n\t$(call docker_build_cmd," name "," dockerfile "," context ")\n";
		# append to the full list of targets and tags
		appendToAllTargets(fullTarget)
		allTags = allTags " " name
	}
	return rules
}

function genSaveRule(allNames) {
	rule = "build\:s3-save:\n"
	split(allNames, names, " ")
	for (i in names) {
		rule = rule "\tdocker save lagoon/" names[i] \
				 " $$(docker history -q lagoon/" names[i] \
				 " | grep -v missing) | gzip -9 | aws s3 cp - s3://lagoon-images/" \
				 names[i] ".tar.gz\n"
	}
	return rule
}

# generate the push-minishift recipe
function genPushMinishiftRule(allTargets) {
	rule = "build\:push-minishift:\n"
	gsub(/build\\:/, "", allTargets)
	split(allTargets, targets, " ")
	for (i in targets) {
		rule = rule "\tdocker tag lagoon/" targets[i] \
				 " $$(cat minishift):30000/lagoon/" targets[i] \
				 " && docker push $$(cat minishift):30000/lagoon/" targets[i] "\n"
	}
	return rule
}

# set the field separator so that
# $1 is the Dockerfile path
# $2 is the image name (and may have some trailing junk)
BEGIN { FS = ":FROM \${IMAGE_REPO:-.*}/" }

{
	image = $2;
	# check if this is the same Dockerfile as the previous record
	if (dockerfile == $1) {
		# same Dockerfile? just add the dependency to the target list and go to
		# the next record
		fullTarget = fullTarget genDependency(image);
		next;
	} else if (dockerfile != "") {
		# different Dockerfile? last one's dependencies must be complete so
		# generate the versions and the recipes using the dockerfile path
		printf genBuildRules(fullTarget, dockerfile)
	}
	# store the Dockerfile path before moving to the next record
	dockerfile = $1;
	fullTarget = genTarget(dockerfile) ":" genDependency(image)
}

END {
	# the block above will only print the rule for a given dockerfile after
	# encountering the _next_ line with a differing dockerfile, so we need to
	# print the last rule(s) here
	printf genBuildRules(fullTarget, dockerfile)
	# generate the s3-save rule
	printf genSaveRule(allNames)
	# generate the push-minishift rule
	printf genPushMinishiftRule(allTags)
	# print the build:all target, with dependencies on all others
	print "build\:all:" allTargets
	print ".PHONY: build\:all build\:list build\:s3-save" allTargets
	# generate the build-list recipe
	# this one is last because we mutate allTargets for it
	gsub(/\\/, "", allTargets)
	gsub(/ /, "\\n", allTargets)
	print "build\:list:\n\t@printf \"build:all" allTargets "\\n\""
}
