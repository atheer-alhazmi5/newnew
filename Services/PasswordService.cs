using Microsoft.AspNetCore.Identity;

namespace FormsSystem.Services;

/// <summary>
/// Password hashing using ASP.NET Core Identity PasswordHasher (built-in, no NuGet needed).
/// Drop-in compatible with BCrypt interface used in controllers.
/// </summary>
public class PasswordService
{
    private readonly PasswordHasher<string> _hasher = new();

    public string Hash(string password)
        => _hasher.HashPassword("user", password);

    public bool Verify(string password, string hash)
    {
        var result = _hasher.VerifyHashedPassword("user", hash, password);
        return result != PasswordVerificationResult.Failed;
    }
}
