
using Analogy.Interfaces;
using Analogy.LogViewer.Server.Interfaces;
using Analogy.LogViewer.Server.Types;
using Analogy.LogViewer.Template.Managers;
using Elastic.CommonSchema;

namespace Analogy.LogViewer.Server
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.
            builder.Services.AddSingleton<Types.FolderAccessManager>();
            builder.Services.AddSingleton<IAnalogyFoldersAccess>(provider => provider.GetRequiredService<Types.FolderAccessManager>());
            builder.Services.AddSingleton<NotificationManager>();
            builder.Services.AddSingleton<UserSettingsManager>();
            builder.Services.AddSingleton<AnalogyNonPersistSettings>();
            builder.Services.AddSingleton<IUserSettingsManager>(provider => provider.GetRequiredService<UserSettingsManager>());
            builder.Services.AddSingleton<IAnalogyUserSettings>(provider => provider.GetRequiredService<UserSettingsManager>());
            builder.Services.AddSingleton<IFactoriesManager, FactoriesManager>();

            builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            var app = builder.Build();

            app.UseDefaultFiles();
            app.MapStaticAssets();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseHttpsRedirection();

            app.UseAuthorization();


            app.MapControllers();

            app.MapFallbackToFile("/index.html");
            var factories = app.Services.GetRequiredService<IFactoriesManager>();
            await factories.AddExternalDataSources();

            await app.RunAsync();
        }
    }
}
