pipeline {
    agent any
    
    tools {
        nodejs 'NodeJS'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    dockerImage = docker.build("my-nodejs-app-review:${env.BUILD_ID}")
                }
            }
        }
        
        stage('Setup Network') {
            steps {
                script {
                    sh 'docker network create shared-network-6 || true'
                }
            }
        }

        
        stage('Run Containers') {
            steps {
                 script {
                     // ایجاد ولوم اگر وجود نداشته باشد
                    sh 'docker volume create mongo_data_review || true'

                    // حذف کانتینرهای قبلی
                    sh 'docker rm -f my-nodejs-app-review || true'
                    sh 'docker rm -f mongodbg || true'
                    
                    // اجرای MongoDB
                    sh """
                        docker run -d \
                        --name mongodbg \
                        --network shared-network-6 \
                        -p 27022:27017 \
                        -v mongo_data_review:/data/db \
                        mongo:5 mongod --bind_ip 0.0.0.0
                    """
                    
                    // اجرای اپلیکیشن Node.js
                    sh """
                        docker run -d \
                        -p 3070:3070 \
                        -p 3071:3071 \
                        -v /etc/letsencrypt:/etc/letsencrypt:ro \
                        --network shared-network-6 \
                        --name my-nodejs-app-review \
                        my-nodejs-app-review:${env.BUILD_ID}
                    """
                }
            }
        }
    }
    
    post {
        failure {
            script {
                sh 'docker rm -f my-nodejs-app-review || true'
                sh 'docker rm -f mongodbg || true'
            }
        }
    }
}
