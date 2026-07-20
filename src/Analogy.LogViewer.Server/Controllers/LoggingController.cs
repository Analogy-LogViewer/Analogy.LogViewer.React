using Analogy.Interfaces;
using Analogy.Interfaces.DataTypes;
using Analogy.LogViewer.ElasticCommonSchema.IAnalogy;
using Analogy.LogViewer.Serilog.IAnalogy;
using Analogy.LogViewer.Server.Types;
using Microsoft.AspNetCore.Mvc;

namespace Analogy.LogViewer.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LoggingController : ControllerBase
    {
        public LoggingController()
        {
        }
        [HttpGet]
        [Route("GetLog")]
        public async Task<ActionResult<List<IAnalogyLogMessage>>> GetLog([FromQuery] string? filePath = null, [FromQuery] LogFileType logFileType = LogFileType.Ecs)
        {
            if (!System.IO.File.Exists(filePath))
            {
                return BadRequest($"File not found: {filePath}");
            }
            try
            {
                await Task.Yield();
                switch (logFileType)
                {
                    case LogFileType.Ecs:
                        var p = new EcsOfflineDataProvider();
                        var msg = await p.Process(filePath, HttpContext.RequestAborted, new MessageHandler());
                        return Ok(msg);
                    case LogFileType.Serilog:
                        var serilog = new SerilogOfflineDataProvider();
                        var serilogMessages = await serilog.Process(filePath, HttpContext.RequestAborted, new MessageHandler());
                        return Ok(serilogMessages);
                }

                return Ok(new List<IAnalogyLogMessage>());
            }
            catch (Exception e)
            {
                return BadRequest($"Error reading file {filePath}:{e.Message}");
            }
            return BadRequest($"Log file type '{logFileType}' is not yet supported.");
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