#!/usr/bin/env bash

set -x
set -euo pipefail

# start minishift and install an app
while ! make minishift; do make minishift/stop; done
oc project myproject
oc new-app https://github.com/sclorg/nodejs-ex -l name=myapp
oc expose svc/nodejs-ex --hostname="$(minishift --profile lagoon ip)"
make up
sleep 5
while ! docker exec -it "$(docker-compose -p lagoon ps -q logs-db)" ./securityadmin_demo.sh; do sleep 5; done
echo "visit http://$(minishift --profile lagoon ip)"
