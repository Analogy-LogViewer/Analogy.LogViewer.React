using Analogy.Interfaces.DataTypes;
using System.Text.RegularExpressions;

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
        private static Regex HasQuestionMarkRegEx = new Regex(@"\?", RegexOptions.Compiled);
        private static Regex IllegalCharactersRegex = new Regex("[" + @"\/:<>|" + "\"]", RegexOptions.Compiled);
        private static Regex CatchExtensionRegex = new Regex(@"^\s*.+\.([^\.]+)\s*$", RegexOptions.Compiled);
        private static string NonDotCharacters = @"[^.]*";
        public static bool IsRunningFromProgramFileFolder()
        {
            var nominalValue =
                AppDomain.CurrentDomain.BaseDirectory.StartsWith(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles))
                || AppDomain.CurrentDomain.BaseDirectory.StartsWith(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86));
            return nominalValue;
        }
        public static string ApplicationBaseDirectory => AppDomain.CurrentDomain.BaseDirectory;
        public static bool MatchedAll(string pattern, IEnumerable<string> files)
        {
            Regex reg = Convert(pattern);
            return files.All(f => reg.IsMatch(f));
        }
        private static Regex Convert(string pattern)
        {
            if (pattern == null)
            {
                throw new ArgumentNullException();
            }
            pattern = pattern.Trim();
            if (pattern.Length == 0)
            {
                throw new ArgumentException("Pattern is empty.");
            }
            if (IllegalCharactersRegex.IsMatch(pattern))
            {
                throw new ArgumentException("Pattern contains illegal characters.");
            }
            bool hasExtension = CatchExtensionRegex.IsMatch(pattern);
            bool matchExact = false;
            if (HasQuestionMarkRegEx.IsMatch(pattern))
            {
                matchExact = true;
            }
            else if (hasExtension)
            {
                matchExact = CatchExtensionRegex.Match(pattern).Groups[1].Length != 3;
            }
            string regexString = Regex.Escape(pattern);
            regexString = "^" + Regex.Replace(regexString, @"\\\*", ".*");
            regexString = Regex.Replace(regexString, @"\\\?", ".");
            if (!matchExact && hasExtension)
            {
                regexString += NonDotCharacters;
            }
            regexString += "$";
            Regex regex = new Regex(regexString, RegexOptions.Compiled | RegexOptions.IgnoreCase);
            return regex;
        }
    }
}