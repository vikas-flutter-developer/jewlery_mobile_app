import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/moodboard_provider.dart';

class MoodboardViewScreen extends ConsumerStatefulWidget {
  final String orderId;

  const MoodboardViewScreen({super.key, required this.orderId});

  @override
  ConsumerState<MoodboardViewScreen> createState() => _MoodboardViewScreenState();
}

class _MoodboardViewScreenState extends ConsumerState<MoodboardViewScreen> {
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _tagsController = TextEditingController();
  final _imageController = TextEditingController();
  List<String> _urlsToAdd = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(moodboardProvider.notifier).fetchMoodboards(widget.orderId);
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _tagsController.dispose();
    _imageController.dispose();
    super.dispose();
  }

  void _showCreateDialog() {
    _titleController.clear();
    _descController.clear();
    _tagsController.clear();
    _imageController.clear();
    _urlsToAdd = [];

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: const Text(
                'NEW DESIGN MOODBOARD',
                style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 16),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: _titleController,
                      decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _descController,
                      decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _tagsController,
                      decoration: const InputDecoration(labelText: 'Tags (Comma separated)', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    const Divider(),
                    const SizedBox(height: 8),
                    const Text('Design Images', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.goldDark)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _imageController,
                            decoration: const InputDecoration(labelText: 'Image URL', border: OutlineInputBorder()),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            final url = _imageController.text.trim();
                            if (url.isNotEmpty) {
                              setDialogState(() {
                                _urlsToAdd.add(url);
                                _imageController.clear();
                              });
                            }
                          },
                          child: const Icon(Icons.add),
                        ),
                      ],
                    ),
                    if (_urlsToAdd.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 60,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _urlsToAdd.length,
                          itemBuilder: (context, idx) {
                            return Stack(
                              children: [
                                Container(
                                  width: 60,
                                  margin: const EdgeInsets.only(right: 8),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.grey.shade300),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.network(_urlsToAdd[idx], fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image)),
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  top: 0,
                                  child: GestureDetector(
                                    onTap: () {
                                      setDialogState(() {
                                        _urlsToAdd.removeAt(idx);
                                      });
                                    },
                                    child: Container(
                                      color: Colors.black.withOpacity(0.5),
                                      child: const Icon(Icons.close, color: Colors.white, size: 16),
                                    ),
                                  ),
                                )
                              ],
                            );
                          },
                        ),
                      )
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  child: const Text('CANCEL', style: TextStyle(color: Colors.black45)),
                  onPressed: () => Navigator.pop(context),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                  child: const Text('CREATE BOARD', style: TextStyle(color: Colors.white)),
                  onPressed: () async {
                    if (_titleController.text.trim().isEmpty) return;
                    
                    final parsedTags = _tagsController.text.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
                    final success = await ref.read(moodboardProvider.notifier).createMoodboard(
                      orderId: widget.orderId,
                      title: _titleController.text.trim(),
                      description: _descController.text.trim(),
                      tags: parsedTags,
                      images: _urlsToAdd,
                    );
                    
                    if (success) {
                      Navigator.pop(context);
                    }
                  },
                )
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(moodboardProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.goldDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'ORDER MOODBOARD (#${widget.orderId})',
          style: const TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            fontSize: 16,
            letterSpacing: 1.0,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_photo_alternate_rounded, color: AppTheme.goldDark),
            onPressed: _showCreateDialog,
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldDark))
          : state.moodboards.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.photo_library_outlined, size: 64, color: AppTheme.goldMetallic.withOpacity(0.4)),
                      const SizedBox(height: 16),
                      const Text('No design moodboards uploaded yet.', style: TextStyle(color: Colors.black38)),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(24),
                  itemCount: state.moodboards.length,
                  itemBuilder: (context, index) {
                    final mb = state.moodboards[index];
                    final images = mb['images'] as List<dynamic>? ?? [];

                    return Container(
                      margin: const EdgeInsets.only(bottom: 24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFFECE6DF)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Images Carousel
                          if (images.isNotEmpty)
                            ClipRRect(
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                              child: CarouselSlider(
                                options: CarouselOptions(
                                  height: 200.0,
                                  viewportFraction: 1.0,
                                  enableInfiniteScroll: false,
                                ),
                                items: images.map((img) {
                                  final url = img is Map ? img['url'] : img.toString();
                                  return Builder(
                                    builder: (BuildContext context) {
                                      return Stack(
                                        children: [
                                          CachedNetworkImage(
                                            imageUrl: url,
                                            width: double.infinity,
                                            height: 200,
                                            fit: BoxFit.cover,
                                            placeholder: (context, url) => Container(
                                              color: Colors.black.withOpacity(0.05),
                                              child: const Center(child: CircularProgressIndicator(color: AppTheme.goldDark)),
                                            ),
                                            errorWidget: (context, url, error) => const Center(child: Icon(Icons.broken_image, size: 40)),
                                          ),
                                          Positioned(
                                            right: 12,
                                            bottom: 12,
                                            child: Container(
                                              decoration: BoxDecoration(color: Colors.black.withOpacity(0.6), shape: BoxShape.circle),
                                              child: IconButton(
                                                icon: const Icon(Icons.download_rounded, color: Colors.white, size: 18),
                                                onPressed: () {
                                                  ref.read(moodboardProvider.notifier).logImageDownload(widget.orderId, mb['moodboardId'], url);
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    const SnackBar(
                                                      content: Text('✓ Image download logged successfully (Security compliance).'),
                                                      backgroundColor: Colors.blueAccent,
                                                    ),
                                                  );
                                                },
                                              ),
                                            ),
                                          )
                                        ],
                                      );
                                    },
                                  );
                                }).toList(),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      mb['title'] ?? 'Custom Design Spec',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF2E2A25)),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                                      onPressed: () {
                                        ref.read(moodboardProvider.notifier).deleteMoodboard(widget.orderId, mb['moodboardId']);
                                      },
                                    ),
                                  ],
                                ),
                                if (mb['description'] != null && mb['description'].toString().isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    mb['description'],
                                    style: const TextStyle(color: Colors.black54, fontSize: 13),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                // Tags list
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: (mb['tags'] as List<dynamic>? ?? []).map((t) {
                                    return Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: AppTheme.goldMetallic.withOpacity(0.08),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        '#$t',
                                        style: const TextStyle(fontSize: 11, color: AppTheme.goldDark, fontWeight: FontWeight.bold),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
