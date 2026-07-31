using Analogy.Interfaces;
using Analogy.Interfaces.DataTypes;
using Analogy.LogViewer.Server.Interfaces;
using Analogy.LogViewer.Server.Types;
using Microsoft.AspNetCore.Mvc;

namespace Analogy.LogViewer.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LoggingController : ControllerBase
    {
        public sealed record DataProviderDto(Guid Id, string Title, string Type);
        public sealed record DataProvidersFactoryDto(Guid FactoryId, string Title, IEnumerable<DataProviderDto> DataProviders);

        [HttpGet]
        [Route("GetProviders")]
        public IEnumerable<DataProvidersFactoryDto> GetProviders([FromServices] IFactoriesManager factoriesManager)
        {
            foreach (var fc in factoriesManager.Factories)
            {
                foreach (var dfc in fc.DataProvidersFactories)
                {
                    var providers = new List<DataProviderDto>();
                    foreach (var dataProvider in dfc.DataProviders)
                    {
                        var providerType = dataProvider is IAnalogyRealTimeDataProvider
                            ? "Realtime"
                            : dataProvider is IAnalogyOfflineDataProvider
                                ? "Offline"
                                : "Unknown";

                        providers.Add(new DataProviderDto(
                            dataProvider.Id,
                            string.IsNullOrWhiteSpace(dataProvider.OptionalTitle) ? dataProvider.Id.ToString() : dataProvider.OptionalTitle,
                            providerType));
                    }

                    yield return new DataProvidersFactoryDto(dfc.FactoryId, dfc.Title, providers);
                }
            }
        }
        [HttpGet]
        [Route("GetLog")]
        public async Task<ActionResult<List<IAnalogyLogMessage>>> GetLog(
            [FromQuery] string? filePath = null,
            [FromQuery] Guid? dataProviderId = null,
            [FromServices] IFactoriesManager? factoriesManager = null)
        {
            if (!System.IO.File.Exists(filePath))
            {
                return BadRequest($"File not found: {filePath}");
            }
            if (dataProviderId is null || dataProviderId == Guid.Empty)
            {
                return BadRequest("A valid data provider id is required.");
            }
            if (factoriesManager is null)
            {
                return BadRequest("Factories manager is not available.");
            }

            try
            {
                await Task.Yield();
                var dataProvider = factoriesManager.GetAllOfflineDataSources(new[] { dataProviderId.Value }).FirstOrDefault();
                if (dataProvider is null)
                {
                    return BadRequest($"Provider not found for id: {dataProviderId}");
                }

                await factoriesManager.InitializeIfNeeded(dataProvider);
                var messages = await dataProvider.Process(filePath, HttpContext.RequestAborted, new MessageHandler());
                return Ok(messages);
            }
            catch (Exception e)
            {
                return BadRequest($"Error reading file {filePath}:{e.Message}");
            }
        }
    }

#pragma warning disable MA0048
    public class MessageHandler : ILogMessageCreatedHandler
    {
        public void AppendMessage(IAnalogyLogMessage message, string dataSource)
        {
        }

        public void AppendMessages(List<IAnalogyLogMessage> messages, string dataSource)
        {
        }

        public void ReportFileReadProgress(AnalogyFileReadProgress progress)
        {
        }
        public bool ForceNoFileCaching { get; set; }
        public bool DoNotAddToRecentHistory { get; set; }
    }
}