using FormsSystem.Data;
using FormsSystem.Services;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// ─── SERVICESss────────────────────────────────────────────────────────────────
builder.Services.AddControllersWithViews();

//JSON file-based data store (no EF Core / NuGet required)
builder.Services.AddSingleton<AppDbContext>();

builder.Services.AddScoped<DataService>();
builder.Services.AddScoped<PdfService>();
builder.Services.AddScoped<ExcelService>();
builder.Services.AddScoped<LdapService>();
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<UiHelperService>();

// Session
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(opt =>
{
    opt.IdleTimeout = TimeSpan.FromMinutes(
        builder.Configuration.GetValue<int>("Session:TimeoutMinutes", 480));
    opt.Cookie.HttpOnly = true;
    opt.Cookie.IsEssential = true;
    opt.Cookie.SameSite = SameSiteMode.Strict;
    opt.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    opt.Cookie.Name = ".FormsSystem.Session";
});

// Antiforgery
builder.Services.AddAntiforgery(opt =>
{
    opt.HeaderName = "X-CSRF-TOKEN";
    opt.Cookie.Name = ".FormsSystem.XSRF";
    opt.Cookie.SameSite = SameSiteMode.Strict;
    opt.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// Kestrel
builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = 50 * 1024 * 1024;
});

// Forwarded headers
builder.Services.Configure<ForwardedHeadersOptions>(opt =>
{
    opt.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    opt.KnownNetworks.Clear();
    opt.KnownProxies.Clear();
});

var app = builder.Build();

// ─── DATA SEED ───────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
   var ds = scope.ServiceProvider.GetRequiredService<DataService>();
   await ds.SeedDataIfEmptyAsync();
   await ds.SeedReadyTablesIfEmptyAsync();
}

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error/Index");
    app.UseHsts();
}

app.UseStaticFiles();
app.UseRouting();

// Security headers
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    ctx.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    ctx.Response.Headers["Pragma"] = "no-cache";
    ctx.Response.Headers["Content-Security-Policy"] =
        "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com " +
        "https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
        "img-src 'self' data: https:;";
    await next();
});

app.UseSession();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Landing}/{id?}");

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Run($"http://0.0.0.0:{port}");
