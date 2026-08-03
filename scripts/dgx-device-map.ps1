# Single source of truth — display names vs SSH aliases vs hostnames.
$DgxDisplayLocal  = 'DGX Sparks local'
$DgxDisplayRemote = 'DGX Sparks remote'
$DgxAliasLocal    = 'DGX-Local'
$DgxAliasRemote   = 'DGX-Remote'
$DgxHostLocal     = 'dgx-spark.local'
# Prefer env overrides so real Tailscale/LAN IPs stay off git history.
$DgxHostRemote    = if ($env:DGX_TAILSCALE_IP) { $env:DGX_TAILSCALE_IP } else { 'dgx-spark.local' }
$DgxUser          = if ($env:DGX_SSH_USER) { $env:DGX_SSH_USER } else { 'sifr' }
$DgxLanIp         = if ($env:DGX_LAN_IP) { $env:DGX_LAN_IP } else { 'dgx-spark.local' }

# Old NVIDIA Sync names only — NOT DGX-Local/DGX-Remote, NOT hostnames (dgx-spark.local etc.)
$DgxLegacyNvsyncAliases = @(
    'Sifr-DGX-Spark', 'Sifr-s-DGX-Spark', 'sifr-s-dgx-spark',
    'dgx-spark', 'DGX-Spark', 'DGX-Spark-2'
)
