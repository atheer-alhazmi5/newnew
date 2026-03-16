namespace FormsSystem.Services;

/// <summary>
/// LDAP authentication stub.
/// When System.DirectoryServices is available (Windows/NuGet), replace the Authenticate body.
/// </summary>
public class LdapService
{
    private readonly IConfiguration _config;
    public bool IsEnabled => _config.GetValue<bool>("LdapSettings:EnableLdap");
    public bool AllowFallback => _config.GetValue<bool>("LdapSettings:AllowLocalAuthFallback");

    public LdapService(IConfiguration config) => _config = config;

    public bool Authenticate(string username, string password)
    {
        // LDAP disabled in this build — local auth fallback handles authentication
        return false;
    }
}
