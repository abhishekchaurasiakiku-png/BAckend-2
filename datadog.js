import tracer from 'dd-trace';

// Initialize the Datadog Tracer
// The tracer automatically reads configuration from environment variables:
// DD_ENV, DD_SERVICE, DD_VERSION, DD_API_KEY, DD_SITE
tracer.init({
  logInjection: true, // Inject trace IDs into logs automatically
});

export default tracer;
