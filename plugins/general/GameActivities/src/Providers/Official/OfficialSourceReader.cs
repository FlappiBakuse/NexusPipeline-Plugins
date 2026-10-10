using AngleSharp.Html.Parser;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class OfficialSourceReader(ActivityHttp http)
{
    private const int NoticeLimit = 40;

    public async Task<OfficialResult> ReadAsync(GameSource source, CancellationToken ct, OfficialResult? previous = null)
    {
        try
        {
        if (source.GameId == "genshin-impact") return await ReadGenshinAsync(source, ct).ConfigureAwait(false);
        if (source.GameId == "wuthering-waves") return await ReadWutheringWavesCatalogAsync(ct).ConfigureAwait(false);
        OfficialNotice[] notices = source.GameId switch
        {
            "blue-archive" => await ReadBlueArchiveAsync(source, ct, previous).ConfigureAwait(false),
            "genshin-impact" or "honkai-star-rail" or "zenless-zone-zero" => await ReadHoyoAsync(source, ct).ConfigureAwait(false),
            "arknights-endfield" => await ReadEndfieldAsync(ct).ConfigureAwait(false),
            "stella-sora" => await ReadStellaAsync(ct).ConfigureAwait(false),
            "wuthering-waves" => await ReadWutheringWavesAsync(ct).ConfigureAwait(false),
            "neverness-to-everness" => await ReadStaticAsync(source, ct).ConfigureAwait(false),
            _ => throw new ActivityException("official_source_unregistered", 502)
        };
        return new(notices, notices.Length == 0 ? "unavailable" : "partial",
            "Bounded official notices; image-only schedules, server clocks and complete banner coverage require separate qualification.");
        }
        catch (Exception error) when (error is InvalidOperationException or FormatException or ArgumentOutOfRangeException)
        {
            throw new ActivityException("official_schema_changed", 502);
        }
    }

    private async Task<JsonNode> JsonAsync(string url, CancellationToken ct)
    {
        var response = await http.ReadAsync(new Uri(url), null, 4194304, ct).ConfigureAwait(false);
        using var content = new MemoryStream(response.Bytes, false);
        var json = await JsonNode.ParseAsync(content, cancellationToken: ct).ConfigureAwait(false);
        ct.ThrowIfCancellationRequested();
        return json ?? throw new ActivityException("official_schema_changed", 502);
    }

    private static JsonArray Rows(JsonNode json, params string[] path)
    {
        JsonNode? node = json;
        foreach (string key in path) node = node?[key];
        return node as JsonArray ?? throw new ActivityException("official_schema_changed", 502);
    }

    private static void RequireCode(JsonNode json)
    {
        if ((json["retcode"] ?? json["code"])?.GetValue<int>() != 0) throw new ActivityException("official_schema_changed", 502);
    }

    private static string Id(JsonNode? value) => value is JsonValue scalar && scalar.TryGetValue<string>(out var text)
        ? text : value?.ToJsonString() ?? throw new ActivityException("official_identity_missing", 502);

    private static DateTimeOffset? Epoch(JsonNode? value, bool milliseconds = false)
    {
        if (value is null || !long.TryParse(Id(value), CultureInfo.InvariantCulture, out long number)) return null;
        return milliseconds ? DateTimeOffset.FromUnixTimeMilliseconds(number) : DateTimeOffset.FromUnixTimeSeconds(number);
    }

    private static async Task<OfficialNotice> NoticeAsync(string title, string html, string url, string locale,
        string sourceUrl, DateTimeOffset? publishedAt, CancellationToken ct)
    {
        using var document = await new HtmlParser().ParseDocumentAsync(html, ct).ConfigureAwait(false);
        var content = document.Body ?? throw new ActivityException("official_schema_changed", 502);
        string text = OfficialNoticeText.Read(content, ct);
        return new(title.Trim(), text, url, locale, sourceUrl, publishedAt,
            content.QuerySelectorAll("img[src]").Length > 0, LinkedNoticeUrls: NoticeLinks(content, new Uri(url)));
    }

    private static string[] NoticeLinks(AngleSharp.Dom.IElement content, Uri origin) => content.QuerySelectorAll("a[href]")
        .Select(link => Uri.TryCreate(origin, link.GetAttribute("href"), out var uri) ? uri : null)
        .Where(uri => uri is not null && uri.Scheme == "https" && uri.Host == origin.Host && uri.UserInfo.Length == 0)
        .Select(uri => uri!.AbsoluteUri).Distinct(StringComparer.Ordinal).Take(40).ToArray();

    private async Task<OfficialNotice[]> ReadBlueArchiveAsync(GameSource source, CancellationToken ct, OfficialResult? previous)
    {
        if (source.ProgressionId == "global") return await ReadNexonAsync(ct, previous).ConfigureAwait(false);
        bool japan = source.ProgressionId == "jp";
        string endpoint = japan
            ? "https://api-web.bluearchive.jp/api/news/list?typeId=0&pageNum=50&pageIndex=1"
            : "https://www.bluearchive-cn.com/api/news/list?pageIndex=1&pageNum=50&type=";
        var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
        if (japan)
        {
            if (json["meta"]?["ok"]?.GetValue<bool>() != true) throw new ActivityException("official_schema_changed", 502);
        }
        else RequireCode(json);
        var notices = new List<OfficialNotice>();
        foreach (var row in Rows(json, "data", "rows").OfType<JsonObject>().Take(NoticeLimit))
        {
            string id = Id(row["id"]);
            if (!long.TryParse(id, out _)) throw new ActivityException("official_identity_invalid", 502);
            notices.Add(await NoticeAsync(ActivityPolicy.Text(row[japan ? "summary" : "title"]), ActivityPolicy.Text(row["content"]),
                japan ? "https://bluearchive.jp/news/newsJump/" + id : "https://www.bluearchive-cn.com/news/" + id,
                japan ? "ja-JP" : "zh-CN", endpoint, Epoch(row["publishTime"], true), ct).ConfigureAwait(false));
        }
        return notices.ToArray();
    }

    private async Task<OfficialNotice[]> ReadNexonAsync(CancellationToken ct, OfficialResult? previous)
    {
        const string communityUrl = "https://forum.nexon.com/api/v1/community/bluearchive-en?alias=bluearchive-en&countryCode=US";
        var community = await JsonAsync(communityUrl, ct).ConfigureAwait(false);
        if (Id(community["communityId"]) != "314" || ActivityPolicy.Text(community["alias"]) != "bluearchive-en")
            throw new ActivityException("official_progression_mismatch", 502);
        var links = new List<(string Thread, string Board)>();
        foreach (string board in new[] { "3218", "3217" })
        {
            string endpoint = $"https://forum.nexon.com/api/v1/board/{board}/threads?alias=bluearchive-en&paginationType=PAGING&pageSize=20&pageNo=1&blockSize=10&hideType=WEB";
            var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
            foreach (var row in Rows(json, "threads").OfType<JsonObject>().Take(8))
                links.Add((Id(row["threadId"]), board));
        }
        foreach (var notice in previous?.Notices ?? [])
        {
            if (!Uri.TryCreate(notice.Url, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != "forum.nexon.com"
                || uri.UserInfo.Length > 0 || uri.AbsolutePath != "/bluearchive-en/board_view") continue;
            var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
            if (query["board"] is "3217" or "3218" && long.TryParse(query["thread"], out _)) links.Add((query["thread"]!, query["board"]!));
        }
        return await Task.WhenAll(links.Distinct().Take(NoticeLimit).Select(async link =>
        {
            if (!long.TryParse(link.Thread, out _)) throw new ActivityException("official_identity_invalid", 502);
            string endpoint = "https://forum.nexon.com/api/v1/thread/" + link.Thread + "?alias=bluearchive-en";
            var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
            if (Id(json["communityId"]) != "314" || Id(json["boardId"]) != link.Board
                || json["threadId"] is not null && Id(json["threadId"]) != link.Thread
                || json["isDelete"]?.GetValue<bool>() == true && json["threadId"] is null)
                throw new ActivityException("official_progression_mismatch", 502);
            var notice = await NoticeAsync(ActivityPolicy.Text(json["title"]), ActivityPolicy.Text(json["content"]),
                $"https://forum.nexon.com/bluearchive-en/board_view?board={link.Board}&thread={link.Thread}", "en-US", endpoint,
                Epoch(json["createDate"]), ct).ConfigureAwait(false);
            return notice with { IsWithdrawn = json["isDelete"]?.GetValue<bool>() == true };
        })).ConfigureAwait(false);
    }

    private async Task<OfficialNotice[]> ReadHoyoAsync(GameSource source, CancellationToken ct)
    {
        var (origin, app, channels, page) = source.GameId switch
        {
            "genshin-impact" => ("act-api-takumi-static.mihoyo.com", "16471662a82d418a", new[] { "721", "719" }, "https://ys.mihoyo.com/main/news/detail/"),
            "honkai-star-rail" => ("act-api-takumi-static.mihoyo.com", "1963de8dc19e461c", new[] { "257" }, "https://sr.mihoyo.com/news/"),
            _ => ("api-takumi-static.mihoyo.com", "706fd13a87294881", new[] { "279", "273" }, "https://zzz.mihoyo.com/news/")
        };
        var notices = new Dictionary<string, OfficialNotice>(StringComparer.Ordinal);
        foreach (string channel in channels)
        {
            string endpoint = $"https://{origin}/content_v2_user/app/{app}/getContentList?iChanId={channel}&iPageSize=50&iPage=1&sLangKey=zh-cn";
            var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
            RequireCode(json);
            foreach (var row in Rows(json, "data", "list").OfType<JsonObject>().Take(channels.Length == 1 ? NoticeLimit : 20))
            {
                string id = Id(row["iInfoId"]);
                if (!long.TryParse(id, out _)) throw new ActivityException("official_identity_invalid", 502);
                notices[id] = await NoticeAsync(ActivityPolicy.Text(row["sTitle"]), ActivityPolicy.Text(row["sContent"]),
                    page + id, "zh-CN", endpoint, null, ct).ConfigureAwait(false);
            }
        }
        return notices.Values.ToArray();
    }

    private async Task<OfficialResult> ReadGenshinAsync(GameSource source, CancellationToken ct)
    {
        var notices = await ReadHoyoAsync(source, ct).ConfigureAwait(false);
        const string root = "https://operation-webstatic.mihoyo.com/gacha_info/hk4e/cn_gf01/";
        const string endpoint = root + "gacha/list.json";
        try
        {
            var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
            RequireCode(json);
            var rows = Rows(json, "data", "list").OfType<JsonObject>().ToArray();
            if (rows.Length is < 1 or > 32) throw new ActivityException("official_catalog_invalid", 502);
            var banners = await Task.WhenAll(rows.Select(async row =>
            {
                string id = Id(row["gacha_id"]);
                if (!System.Text.RegularExpressions.Regex.IsMatch(id, @"^[a-f0-9]{40}$")) throw new ActivityException("official_identity_invalid", 502);
                int type = row["gacha_type"]?.GetValue<int>() ?? throw new ActivityException("official_catalog_invalid", 502);
                string category = type switch { 100 or 200 or 301 or 400 => "gacha-character", 302 => "gacha-weapon", 500 => "gacha-other", _ => throw new ActivityException("official_catalog_type_unknown", 502) };
                string detailUrl = root + id + "/zh-cn.json";
                var detail = await JsonAsync(detailUrl, ct).ConfigureAwait(false);
                if (detail["gacha_type"]?.GetValue<int>() != type) throw new ActivityException("official_identity_invalid", 502);
                var notice = await NoticeAsync(ActivityPolicy.Text(detail["title"]), ActivityPolicy.Text(detail["content"]), detailUrl, "zh-CN", detailUrl, null, ct).ConfigureAwait(false);
                using var titleHtml = await new HtmlParser().ParseDocumentAsync(notice.Title, ct).ConfigureAwait(false);
                string title = titleHtml.Body?.TextContent.Trim() ?? "";
                if (title.Length == 0 || notice.Text.Length == 0) throw new ActivityException("official_catalog_invalid", 502);
                bool permanent = type == 200 && title.Contains("常驻祈愿", StringComparison.Ordinal);
                if (type == 200 && !permanent) throw new ActivityException("official_catalog_invalid", 502);
                string start = ActivityPolicy.Text(row["begin_time"]), end = ActivityPolicy.Text(row["end_time"]);
                if (!DateTime.TryParseExact(start, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                    || !DateTime.TryParseExact(end, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                    throw new ActivityException("official_catalog_invalid", 502);
                return notice with
                {
                    Title = title,
                    Banner = new(id, category, start, permanent ? null : end, permanent ? "permanent" : "limited")
                };
            })).ConfigureAwait(false);
            if (banners.Select(item => item.Banner!.Id).Distinct().Count() != banners.Length) throw new ActivityException("official_catalog_invalid", 502);
            return new([.. notices, .. banners], "partial", "Official notices and current domestic wish catalog.",
                new(endpoint, banners.Select(item => item.Banner!.Id).ToArray(), "cn_gf01 current official wish catalog: every listed type and its detail document validated. Announced later batches are retained from notices; account-specific beginner eligibility is not asserted. Metadata expiry is not a permanent wish deadline; timezone-free catalog clocks remain unqualified."));
        }
        catch (Exception error) when (error is ActivityException or HttpRequestException or System.Text.Json.JsonException)
        {
            return new(notices, "partial", "Official notice list available; current wish catalog failed qualification (" + error.GetType().Name + ").");
        }
    }

    private async Task<OfficialNotice[]> ReadEndfieldAsync(CancellationToken ct)
    {
        const string endpoint = "https://web-news.hypergryph.com/api/bulletin?lang=zh-cn&code=endfield_web&page=1&pageSize=50";
        var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
        RequireCode(json);
        return await Task.WhenAll(Rows(json, "data", "list").OfType<JsonObject>().Take(20).Select(async row =>
        {
            string id = Id(row["cid"]);
            if (!long.TryParse(id, out _)) throw new ActivityException("official_identity_invalid", 502);
            string detail = $"https://web-news.hypergryph.com/api/bulletin/{id}?lang=zh-cn&code=endfield_web";
            var response = await JsonAsync(detail, ct).ConfigureAwait(false);
            RequireCode(response);
            var data = response["data"] ?? throw new ActivityException("official_schema_changed", 502);
            if (Id(data["cid"]) != id) throw new ActivityException("official_identity_invalid", 502);
            return await NoticeAsync(ActivityPolicy.Text(data["title"]), ActivityPolicy.Text(data["data"]),
                "https://endfield.hypergryph.com/news/" + id, "zh-CN", detail, Epoch(data["displayTime"]), ct).ConfigureAwait(false);
        })).ConfigureAwait(false);
    }

    private async Task<OfficialNotice[]> ReadStellaAsync(CancellationToken ct)
    {
        var notices = new List<OfficialNotice>();
        for (int page = 1; page <= 5; page++)
        {
            string endpoint = "https://stellasora.yostar.cn/api/resource/news?index=" + page;
            var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
            RequireCode(json);
            var rows = Rows(json, "data", "rows");
            foreach (var row in rows.OfType<JsonObject>())
            {
                string id = Id(row["id"]);
                if (!long.TryParse(id, out _)) throw new ActivityException("official_identity_invalid", 502);
                string url = ActivityPolicy.Text(row["link"]);
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != "stellasora.yostar.cn" || uri.AbsolutePath != "/news/" + id)
                    continue;
                notices.Add(await NoticeAsync(ActivityPolicy.Text(row["title"]), ActivityPolicy.Text(row["description"]),
                    url, "zh-CN", endpoint, Epoch(row["publishTime"], true), ct).ConfigureAwait(false));
            }
            if (rows.Count == 0 || notices.Count >= NoticeLimit) break;
        }
        return await Task.WhenAll(notices.Take(NoticeLimit).Select(async item =>
        {
            string id = new Uri(item.Url).Segments[^1];
            string endpoint = "https://stellasora.yostar.cn/api/resource/news/" + id;
            var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
            RequireCode(json);
            var detail = json["data"]?["news"] ?? throw new ActivityException("official_schema_changed", 502);
            if (Id(detail["id"]) != id) throw new ActivityException("official_identity_invalid", 502);
            return await NoticeAsync(ActivityPolicy.Text(detail["title"]), ActivityPolicy.Text(detail["content"]),
                item.Url, "zh-CN", endpoint, Epoch(detail["publishTime"], true), ct).ConfigureAwait(false);
        })).ConfigureAwait(false);
    }

    private async Task<OfficialNotice[]> ReadWutheringWavesAsync(CancellationToken ct)
    {
        const string root = "https://media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/zh/";
        string endpoint = root + "MainMenu.json";
        var json = await JsonAsync(endpoint, ct).ConfigureAwait(false);
        // The home-page catalog and ArticleMenu are separate publications and can have different revisions.
        var rows = Rows(json, "article").OfType<JsonObject>().DistinctBy(row => Id(row["articleId"]))
            .Where(row => row["articleType"]?.GetValue<int>() is 0 or 52 or 53).Take(16).ToArray();
        return await Task.WhenAll(rows.Select(async row =>
        {
            string id = Id(row["articleId"]);
            if (!long.TryParse(id, out _)) throw new ActivityException("official_identity_invalid", 502);
            string detail = root + "article/" + id + ".json";
            var article = await JsonAsync(detail, ct).ConfigureAwait(false);
            if (Id(article["articleId"]) != id || Id(article["gameId"]) != "G152") throw new ActivityException("official_progression_mismatch", 502);
            return await NoticeAsync(ActivityPolicy.Text(article["articleTitle"]), ActivityPolicy.Text(article["articleContent"]),
                "https://mc.kurogames.com/main/news/detail/" + id, "zh-CN", detail, null, ct).ConfigureAwait(false);
        })).ConfigureAwait(false);
    }

    private async Task<OfficialResult> ReadWutheringWavesCatalogAsync(CancellationToken ct)
    {
        var notices = await ReadWutheringWavesAsync(ct).ConfigureAwait(false);
        try
        {
            var response = await http.ReadAsync(new Uri(OfficialWikiCatalog.Endpoint), null, 4194304, ct, HttpMethod.Post,
                new Dictionary<string, string> { ["wiki_type"] = "9", ["source"] = "h5", ["Origin"] = "https://wiki.kurobbs.com", ["Referer"] = "https://wiki.kurobbs.com/mc/home" }).ConfigureAwait(false);
            return OfficialWikiCatalog.WutheringWaves(notices, JsonNode.Parse(response.Bytes) ?? throw new ActivityException("official_schema_changed", 502));
        }
        catch (Exception error) when (error is HttpRequestException or ActivityException or JsonException or InvalidOperationException or FormatException)
        {
            return new(notices, "partial", "Publisher notices retained; official community wiki current-pool directory is unavailable or cannot be cross-checked.");
        }
    }

    private async Task<OfficialNotice[]> ReadStaticAsync(GameSource source, CancellationToken ct)
    {
        var index = new Uri(source.OfficialUrl);
        var response = await http.ReadAsync(index, null, 4194304, ct).ConfigureAwait(false);
        using var document = await new HtmlParser().ParseDocumentAsync(Encoding.UTF8.GetString(response.Bytes), ct).ConfigureAwait(false);
        var links = document.QuerySelectorAll("a[href]").Select(a => Uri.TryCreate(index, a.GetAttribute("href"), out var uri) ? uri : null)
            .Where(uri => uri is not null && uri.Scheme == "https" && uri.Host == index.Host && uri.AbsolutePath.Contains("/20", StringComparison.Ordinal)
                && uri.AbsolutePath.EndsWith(".html", StringComparison.Ordinal)).DistinctBy(uri => uri!.AbsoluteUri).Take(12).ToArray();
        return await Task.WhenAll(links.Select(async uri =>
        {
            var page = await http.ReadAsync(uri!, null, 4194304, ct).ConfigureAwait(false);
            using var notice = await new HtmlParser().ParseDocumentAsync(Encoding.UTF8.GetString(page.Bytes), ct).ConfigureAwait(false);
            var title = notice.QuerySelector("h1.articleTitle");
            var content = notice.QuerySelector(".articleContent");
            if (title is null || content is null) throw new ActivityException("official_schema_changed", 502);
            return new OfficialNotice(title.TextContent.Trim(), OfficialNoticeText.Read(content, ct), uri!.AbsoluteUri, source.Locale,
                uri.AbsoluteUri, null, content.QuerySelectorAll("img[src]").Length > 0, LinkedNoticeUrls: NoticeLinks(content, uri));
        })).ConfigureAwait(false);
    }
}
