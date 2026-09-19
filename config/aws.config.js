'use strict';

/**
 * AWS SDK configuration
 * اعتبارنامه‌ها از env.config خوانده می‌شوند — هرگز hardcode نمی‌شوند.
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { getConfig, requireAwsConfig } = require('./env.config');

let _s3Client = null;

function getS3Client() {
  if (_s3Client) return _s3Client;

  const aws = requireAwsConfig();

  const options = {
    region: aws.region,
    // جلوگیری از لیک اعتبارنامه در لاگ‌ها
    logger: {
      debug: () => {},
      info:  () => {},
      warn:  (msg) => console.warn('[AWS]', redact(msg)),
      error: (msg) => console.error('[AWS]', redact(msg)),
    },
  };

  // اگر کلید صریح داده نشده، SDK خودش زنجیره‌ی credential
  // (IAM Role / ECS task role / ~/.aws) را استفاده می‌کند.
  if (aws.accessKeyId && aws.secretAccessKey) {
    options.credentials = {
      accessKeyId:     aws.accessKeyId,
      secretAccessKey: aws.secretAccessKey,
    };
  }

  _s3Client = new S3Client(options);
  return _s3Client;
}

function redact(msg) {
  if (typeof msg !== 'string') return '[redacted]';
  return msg.replace(/A(?:KIA|SIA)[0-9A-Z]{16}/g, '[REDACTED]');
}

function getBucket() {
  return getConfig().aws.s3Bucket;
}

module.exports = { getS3Client, getBucket };
