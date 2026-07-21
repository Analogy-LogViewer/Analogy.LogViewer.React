using Analogy.Interfaces.DataTypes;

namespace Analogy.LogViewer.Server.Types
{
    public static class CommonUtils
    {
        public static string ColumnThreadId => nameof(AnalogyLogMessage.ThreadId);
        public static string ColumnProcessId => nameof(AnalogyLogMessage.ProcessId);
        public static string ColumnModule => nameof(AnalogyLogMessage.Module);
        public static string ColumnRawText => nameof(AnalogyLogMessage.RawText);
        public static string AnalogyMessageColumn { get; } = Guid.NewGuid().ToString();
        public static List<string> LogLevels { get; } = Enum.GetValues(typeof(AnalogyLogLevel)).Cast<AnalogyLogLevel>()
            .Select(e => e.ToString()).ToList();
        public static bool IsRunningFromProgramFileFolder()
        {
            var nominalValue =
                AppDomain.CurrentDomain.BaseDirectory.StartsWith(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles))
                || AppDomain.CurrentDomain.BaseDirectory.StartsWith(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86));
            return nominalValue;
        }
    }
}