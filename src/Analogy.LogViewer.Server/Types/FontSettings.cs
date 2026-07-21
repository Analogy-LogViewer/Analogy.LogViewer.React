using System.Text.Json.Serialization;
using static System.Net.Mime.MediaTypeNames;

namespace Analogy.LogViewer.Server.Types
{
    [Serializable]
    public class FontSettings
    {
        public FontSelectionType FontSelectionType { get; set; }
        public FontSelectionType MenuFontSelectionType { get; set; }
        public float GridFontSize { get; set; }
        public string FontName { get; set; }
        public float FontSize { get; set; }
        public string MenuFontName { get; set; }
        public float MenuFontSize { get; set; }

        public FontSettings()
        {
            GridFontSize = 8.5f;
            SetFontSelectionType(FontSelectionType.Default, "Tahoma");
            SetMenuFontSelectionType(FontSelectionType.Normal, "Segoe UI");
        }

        public void SetFontSelectionType(FontSelectionType mode, string fontName)
        {
            FontSelectionType = mode;
            FontName = fontName;
            switch (mode)
            {
                case FontSelectionType.Default:
                    FontSize = 8.25f;
                    break;
                case FontSelectionType.Normal:
                    FontSize = 10f;
                    break;
                case FontSelectionType.Large:
                    FontSize = 12f;
                    break;
                case FontSelectionType.VeryLarge:
                    FontSize = 14f;
                    break;
                default:
                    FontSize = 8.25f;
                    break;
            }
        }
        public void SetMenuFontSelectionType(FontSelectionType mode, string fontName)
        {
            MenuFontSelectionType = mode;
            MenuFontName = fontName;
            switch (mode)
            {
                case FontSelectionType.Default:
                    MenuFontSize = 12f;
                    break;
                case FontSelectionType.Normal:
                    MenuFontSize = 10f;
                    break;
                case FontSelectionType.Large:
                    MenuFontSize = 14f;
                    break;
                case FontSelectionType.VeryLarge:
                    MenuFontSize = 16f;
                    break;
                default:
                    MenuFontSize = 12f;
                    break;
            }
        }
    }
}
