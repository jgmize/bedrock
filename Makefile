#TODO: switch to 'git rev-parse --short HEAD'
GIT_COMMIT ?= $(git rev-parse HEAD)
VERSION ?= $(shell git describe --tags --exact-match 2>/dev/null || echo ${GIT_COMMIT})
REGISTRY ?=
IMAGE_PREFIX ?= mozorg
BASE_IMAGE_NAME ?= bedrock_base
DEV_IMAGE_NAME ?= bedrock_dev
CODE_IMAGE_NAME ?= bedrock_code
L10N_IMAGE_NAME ?= bedrock_l10n
BASE_IMAGE ?= ${REGISTRY}${IMAGE_PREFIX}/${BASE_IMAGE_NAME}\:${VERSION}
DEV_IMAGE ?= ${REGISTRY}${IMAGE_PREFIX}/${DEV_IMAGE_NAME}\:${VERSION}
CODE_IMAGE ?= ${REGISTRY}${IMAGE_PREFIX}/${CODE_IMAGE_NAME}\:${VERSION}
L10N_IMAGE ?= ${REGISTRY}${IMAGE_PREFIX}/${L10N_IMAGE_NAME}\:${VERSION}
PWD ?= $(shell pwd)
GIT_DIR ?= ${PWD}/.git
DB ?= ${PWD}/bedrock.db
ENV_FILE ?= .env
SERVE_PORT ?= 8000
DOCKER_RUN_ARGS ?= --env-file ${ENV_FILE} -e SSLIFY_DISABLE=True -v ${DB}\:/app/bedrock.db -v ${GIT_DIR}\:/app/.git -w /app
CONTAINER_ID ?= $(shell docker ps | grep ${DEV_IMAGE} | head -n 1 | awk '{print $$1}')
CODE_CONTAINER_ID ?= $(shell docker ps | grep ${CODE_IMAGE} | head -n 1 | awk '{print $$1}')
DEIS_APPLICATION ?= bedrock-demo-jgmize

env:
	@if [[ ! -e ${ENV_FILE} ]]; then \
		sed -e s/DISABLE_SSL=False/DISABLE_SSL=True/ .bedrock_demo_env > ${ENV_FILE}; \
	fi

devserver: env
	docker run ${DOCKER_RUN_ARGS} -p "${SERVE_PORT}:${SERVE_PORT}" ${DEV_IMAGE} ./manage.py runserver 0.0.0.0\:${SERVE_PORT}

codeserver: env
	docker run ${DOCKER_RUN_ARGS} -p "${SERVE_PORT}:${SERVE_PORT}" ${CODE_IMAGE} ./manage.py runserver 0.0.0.0\:${SERVE_PORT}

shell_plus: env
	@if [[ -n "${CONTAINER_ID}" ]]; then \
		docker exec -it ${CONTAINER_ID} ./manage.py shell_plus; \
	else \
		docker run -it ${DOCKER_RUN_ARGS} ${DEV_IMAGE} ./manage.py shell_plus; \
	fi

collectstatic: env
	@if [[ -n "${CONTAINER_ID}" ]]; then \
		docker exec -it ${CONTAINER_ID} ./manage.py collectstatic; \
	else \
		docker run -it ${DOCKER_RUN_ARGS} ${DEV_IMAGE} ./manage.py collectstatic --noinput; \
	fi

sh: env
	@if [[ -n "${CONTAINER_ID}" ]]; then \
		docker exec -it ${CONTAINER_ID} sh; \
	else \
		docker run -it ${DOCKER_RUN_ARGS} ${DEV_IMAGE} sh; \
	fi

build-base:
	docker build -f docker/dockerfiles/bedrock_base -t ${BASE_IMAGE} .

build-squash-base:
	docker build -f docker/dockerfiles/bedrock_base -t ${BASE_IMAGE}-tmp .
	docker save ${BASE_IMAGE}-tmp | sudo docker-squash -t ${BASE_IMAGE}-squashed | docker load
	docker tag ${BASE_IMAGE}-squashed ${BASE_IMAGE}

build-dev:
	docker build -f docker/dockerfiles/bedrock_dev -t ${DEV_IMAGE} .

build-code:
	DOCKERFILE=Dockerfile-code-${VERSION}
	FROM_DOCKER_REPOSITORY=mozorg/bedrock_base
	envsubst < docker/dockerfiles/bedrock_code > ${DOCKERFILE}
	docker build -f ${DOCKERFILE} -t ${CODE_IMAGE} .
	rm ${DOCKERFILE}

build-l10n:
	export DOCKER_REPOSITORY=mozorg/bedrock_l10n
	export FROM_DOCKER_REPOSITORY=mozorg/bedrock_code
	./docker/jenkins/include_l10n.sh

push-usw:
	export FROM_DOCKER_REPOSITORY=mozorg/bedrock_l10n
	export PRIVATE_REGISTRIES=localhost:5001
	export DEIS_APPS=${DEIS_APPLICATION}
	./docker/jenkins/push2privateregistries.sh
	DEIS_PROFILE=usw
	deis pull ${DEIS_APPLICATION}:${GIT_COMMIT} -a ${DEIS_APPLICATION}

push-euw:
	export FROM_DOCKER_REPOSITORY=mozorg/bedrock_l10n
	export PRIVATE_REGISTRIES=localhost:5000
	export DEIS_APPS=${DEIS_APPLICATION}
	./docker/jenkins/push2privateregistries.sh
	DEIS_PROFILE=euw
	deis pull ${DEIS_APPLICATION}:${GIT_COMMIT} -a ${DEIS_APPLICATION}
