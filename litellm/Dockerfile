FROM ghcr.io/berriai/litellm:main-stable

WORKDIR /app

# Copy configuration
COPY config.yaml /app/config.yaml

# Copy custom callback for UsageFlow tracking
COPY usageflow_callback.py /app/usageflow_callback.py

# Install httpx for async HTTP calls in callback
RUN pip install httpx

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Run LiteLLM proxy
CMD ["--config", "/app/config.yaml", "--port", "4000", "--num_workers", "2"]
