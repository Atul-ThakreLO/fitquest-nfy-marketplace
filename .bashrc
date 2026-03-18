if [[ -n "$ANTIGRAVITY_AGENT" ]]; then
    # Force the shell to behave as a simple pipe
    export TERM=dumb
    export DEBIAN_FRONTEND=noninteractive
    # Disable aliases that might wait for terminal polling
    unalias -a
fi
