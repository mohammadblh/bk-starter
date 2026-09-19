pipeline {
    agent any

    tools {
        nodejs 'NodeJS'
    }

    environment {
        APP_NAME  = 'bk-starter'
        NETWORK   = 'starter-network'
        MONGO_VOL = 'starter_mongo_data'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        // گیت امنیتی: build با secret لو رفته یا وابستگی آسیب‌پذیر رد می‌شود
        stage('Security Gate') {
            steps {
                sh 'node scripts/scan-secrets.js .'
                sh 'npm audit --audit-level=high'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Image') {
            steps {
                script {
                    dockerImage = docker.build("${APP_NAME}:${env.BUILD_ID}")
                }
            }
        }

        stage('Deploy') {
            steps {
                // اعتبارنامه‌ها از Jenkins Credentials Store می‌آیند —
                // هرگز در Jenkinsfile یا image نوشته نمی‌شوند
                withCredentials([
                    usernamePassword(credentialsId: 'starter-mongo',
                                     usernameVariable: 'MONGO_USER',
                                     passwordVariable: 'MONGO_PASSWORD'),
                    file(credentialsId: 'starter-env', variable: 'ENV_FILE')
                ]) {
                    sh 'docker network create ${NETWORK} || true'
                    sh 'docker volume create ${MONGO_VOL} || true'

                    sh 'docker rm -f ${APP_NAME} || true'
                    sh 'docker rm -f ${APP_NAME}-mongodb || true'

                    // MongoDB: با --auth و بدون publish کردن پورت روی هاست.
                    // نسخه‌ی قبلی با --bind_ip 0.0.0.0 و -p 27022:27017 بدون
                    // احراز هویت روی اینترنت باز بود.
                    sh '''
                        docker run -d \
                          --name ${APP_NAME}-mongodb \
                          --network ${NETWORK} \
                          -e MONGO_INITDB_ROOT_USERNAME=${MONGO_USER} \
                          -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD} \
                          -v ${MONGO_VOL}:/data/db \
                          --restart unless-stopped \
                          --security-opt no-new-privileges:true \
                          mongo:7 mongod --auth
                    '''

                    // اپ: فقط روی loopback؛ TLS توسط nginx جلویی
                    sh '''
                        docker run -d \
                          --name ${APP_NAME} \
                          --network ${NETWORK} \
                          -p 127.0.0.1:3000:3000 \
                          --env-file ${ENV_FILE} \
                          -e NODE_ENV=production \
                          -e PORT=3000 \
                          -e MONGODB_URI="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${APP_NAME}-mongodb:27017/starter?authSource=admin" \
                          --restart unless-stopped \
                          --security-opt no-new-privileges:true \
                          ${APP_NAME}:${BUILD_ID}
                    '''
                }
            }
        }
    }

    post {
        failure {
            sh 'docker rm -f ${APP_NAME} || true'
        }
        always {
            // فایل env موقت را روی agent باقی نگذار
            sh 'rm -f ${WORKSPACE}/.env || true'
        }
    }
}
