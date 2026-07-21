using System.ComponentModel.DataAnnotations;

namespace Analogy.LogViewer.Server.Types
{
    public enum DataProviderFactoryStatus
    {
        NotSet,
        Enabled,
        Disabled,
    }
    public enum PreDefinedQueryType
    {
        Contains,
        Equals,
    }
    public enum LogLevelSelectionType
    {
        Single,
        Multiple,
    }
    public enum BuiltInSearchPanelMode
    {
        Search,
        Filter,
    }
    public enum FontSelectionType
    {
        Default,
        Normal,
        Large,
        VeryLarge,
        Manual,
    }
    public enum TimeOffsetType
    {
        None,
        Predefined,
        UtcToLocalTime,
        LocalTimeToUtc,
    }
    public enum AnalogyCommandLayout
    {
        Classic,
        Simplified,
    }
    public enum MainFormType
    {
        RibbonForm,
        FluentForm,
    }
    public enum UpdateMode
    {
        [Display(Name = "Never")] Never,
        [Display(Name = "Each Startup")] EachStartup,
        [Display(Name = "Once a Week")] OnceAWeek,
        [Display(Name = "Once a Month")] OnceAMonth,
    }
    public enum SettingsMode
    {
        None = -1,
        PerUser,
        ApplicationFolder,
        ProgramData,
    }
}
